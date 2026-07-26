import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { sendBookingEmail } from '../services/email.service';
import { generateCustomId } from '../utils/id.util';
import { createNotification } from '../services/notification.service';
import { parsePagination } from '../utils/pagination.util';

// POST /api/v1/bookings (Create a booking after Razorpay success/init)
export const createBooking = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    const { service_type, service_id, service_name, check_in, check_out, guests, notes, adults, children, bed_type, room_type, rooms, payment_method } = req.body;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(service_id || ''));

    // ── Availability Check ──
    if (check_in && isUuid) {
      let endDate = check_out;
      if (!endDate) {
        const nextDay = new Date(check_in);
        nextDay.setDate(nextDay.getDate() + 1);
        endDate = nextDay.toISOString().slice(0, 10);
      }

      // Check for existing bookings
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booked_rooms')
        .eq('service_id', service_id)
        .in('status', ['confirmed', 'in_progress'])
        .gte('check_in', check_in)
        .lt('check_in', endDate);

      if (bookingsError && bookingsError.code !== '42703') throw bookingsError;

      // Calculate total rooms booked for these dates
      const bookedRoomsSum = existingBookings?.reduce((sum, b) => sum + (b.booked_rooms || 1), 0) || 0;
      const requestedRooms = rooms ? Math.max(1, Number(rooms)) : 1;
      
      let maxRooms = 1; // Default for non-homestays
      if (service_type === 'homestay') {
          const { data: hs } = await supabase.from('homestays').select('number_of_rooms').eq('id', service_id).single();
          if (hs && hs.number_of_rooms) maxRooms = hs.number_of_rooms;
      }
      
      if (bookedRoomsSum + requestedRooms > maxRooms) {
        return res.status(409).json({ error: 'Selected dates are unavailable (not enough rooms)' });
      }

      // Check for blocked dates
      const { data: blockedDates, error: blockedError } = await supabase
        .from('provider_blocked_dates')
        .select('id')
        .eq('service_id', service_id)
        .gte('blocked_date', check_in)
        .lt('blocked_date', endDate);

      if (blockedError && blockedError.code !== '42P01') throw blockedError;

      if (blockedDates && blockedDates.length > 0) {
        return res.status(409).json({ error: 'Selected dates are unavailable (blocked by provider)' });
      }
    }

    // ── Price validation & calculation ──
    let unitPrice = 0;
    
    if (isUuid) {
      if (service_type === 'package') {
        const { data: pkg } = await supabase.from('packages').select('price_per_person').eq('id', service_id).single();
        if (pkg && pkg.price_per_person) unitPrice = Number(pkg.price_per_person);
      } else if (service_type === 'homestay') {
        const { data: hs } = await supabase.from('homestays').select('price_per_night').eq('id', service_id).single();
        if (hs && hs.price_per_night) {
          let nights = 1;
          if (check_in && check_out) {
            const diffMs = new Date(check_out).getTime() - new Date(check_in).getTime();
            nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          }
          unitPrice = Number(hs.price_per_night) * nights;
        }
      } else if (service_type === 'transport') {
        const { data: tr } = await supabase.from('transports').select('price_per_day').eq('id', service_id).single();
        if (tr && tr.price_per_day) unitPrice = Number(tr.price_per_day);
      } else if (service_type === 'guide') {
        const { data: g } = await supabase.from('guides').select('price_per_day').eq('id', service_id).single();
        if (g && g.price_per_day) unitPrice = Number(g.price_per_day);
      }
    }

    const validGuests = guests ? Math.max(1, Number(guests)) : 1;
    const validRooms = rooms ? Math.max(1, Number(rooms)) : 1;
    
    let total_amount = 0;
    if (unitPrice > 0) {
      if (service_type === 'homestay') {
        total_amount = unitPrice * validRooms;
      } else {
        total_amount = unitPrice * validGuests;
      }
    } else {
      // Fallback for demo items or when DB price lookup returns empty
      total_amount = req.body.total_amount ? Number(req.body.total_amount) : 999;
    }

    let prefix = 'BY-BKG';
    if (service_type === 'homestay') prefix = 'BY-H-BKG';
    else if (service_type === 'package') prefix = 'BY-P-BKG';
    else if (service_type === 'guide') prefix = 'BY-G-BKG';
    else if (service_type === 'transport') prefix = 'BY-T-BKG';

    // Combine new fields into notes
    let enrichedNotes = notes || '';
    const details = [];
    if (!isUuid && service_id) details.push(`Original Service ID: ${service_id}`);
    if (adults !== undefined) details.push(`Adults: ${adults}`);
    if (children !== undefined) details.push(`Children: ${children}`);
    if (rooms !== undefined) details.push(`Rooms: ${rooms}`);
    if (room_type) details.push(`Room Type: ${room_type}`);
    if (bed_type) details.push(`Bed Type: ${bed_type}`);
    
    if (details.length > 0) {
      const detailStr = details.join(' | ');
      enrichedNotes = enrichedNotes ? `${detailStr}\n\nAdditional Notes:\n${enrichedNotes}` : detailStr;
    }

    // Because bookings.service_id column is UUID, fallback to zero UUID for non-UUID demo items to avoid 22P02 syntax error
    const safeServiceId = isUuid ? service_id : '00000000-0000-0000-0000-000000000000';

    let bookingData: any = { 
      custom_id: generateCustomId(prefix),
      service_type,
      service_id: safeServiceId,
      service_name,
      check_in: check_in || null,
      check_out: check_out || null,
      guests: validGuests,
      total_amount,
      notes: enrichedNotes.trim() || null,
      user_id: userId,
      status: 'pending',
      payment_status: 'unpaid',
      booked_rooms: validRooms
    };

    let { data, error } = await supabase
      .from('bookings')
      .insert([bookingData])
      .select()
      .single();

    // If booked_rooms or custom_id column is missing or causes schema error, retry insertion without optional columns
    if (error && (error.code === '42703' || error.message?.includes('booked_rooms') || error.message?.includes('custom_id'))) {
      const fallbackBookingData = {
        service_type,
        service_id: safeServiceId,
        service_name,
        check_in: check_in || null,
        check_out: check_out || null,
        guests: validGuests,
        total_amount,
        notes: enrichedNotes.trim() || null,
        user_id: userId,
        status: 'pending',
        payment_status: 'unpaid'
      };
      const retryResult = await supabase
        .from('bookings')
        .insert([fallbackBookingData])
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) throw error;
    
    // Send in-app and push notification
    if (userId) {
      createNotification(
        userId,
        'Booking Received',
        `Your booking for ${service_name} has been received.`,
        'booking',
        'fas fa-ticket text-blue-500',
        '/dashboard/user/bookings'
      );
    }

    return res.status(201).json(data);
  } catch (error: any) {
    console.error('createBooking error:', error);
    return res.status(500).json({ 
      error: error?.message || error?.details || 'Internal server error',
      code: error?.code
    });
  }
};

// GET /api/v1/bookings/my (User's booking history)
export const getMyBookings = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/bookings/:id (Single booking details)
export const getBookingById = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;
    const role = req.user?.role;

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Booking not found' });

    // Allow user who made it, or an admin to see the booking
    if (data.user_id !== userId && role !== 'admin' && role !== 'superadmin') {
       return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch user details for enrichment
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', data.user_id)
      .single();

    // Fetch service location details
    let location = 'Bihar, India';
    if (data.service_type === 'homestay') {
      const { data: hs } = await supabase.from('homestays').select('location').eq('id', data.service_id).single();
      if (hs) location = hs.location;
    } else if (data.service_type === 'package') {
      const { data: pkg } = await supabase.from('packages').select('route').eq('id', data.service_id).single();
      if (pkg && pkg.route) location = pkg.route;
    } else if (data.service_type === 'transport') {
      const { data: tr } = await supabase.from('transports').select('route_from, route_to').eq('id', data.service_id).single();
      if (tr) location = `${tr.route_from} to ${tr.route_to}`;
    } else if (data.service_type === 'guide') {
      const { data: g } = await supabase.from('guides').select('location').eq('id', data.service_id).single();
      if (g && (g as any).location) location = (g as any).location;
    }

    let derivedStatus = data.status;
    if (data.status === 'confirmed' && data.checked_in_at && !data.checked_out_at) {
      derivedStatus = 'checked_in';
    }

    let offlineName = null;
    if (data.notes && typeof data.notes === 'string') {
        const match = data.notes.match(/Name:\s*(.*?)\s*\|/);
        if (match && match[1]) offlineName = match[1].trim();
    }

    const enrichedBooking = {
      ...data,
      status: derivedStatus,
      guest_name: offlineName || userProfile?.name || 'Guest',
      guest_email: userProfile?.email || '',
      guest_phone: userProfile?.phone || '',
      location,
    };

    return res.status(200).json(enrichedBooking);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/bookings/:id/confirm-location (Confirm Pay at Location booking — 20% advance paid via Razorpay)
export const confirmLocationBooking = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    // Update booking status to confirmed (payment_status is already set by Razorpay verify/webhook)
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Fetch user details for email
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', booking.user_id)
      .single();

    // Fetch service location details
    let details: { location?: string } = {};
    if (booking.service_type === 'homestay') {
      const { data: hs } = await supabase.from('homestays').select('location').eq('id', booking.service_id).single();
      if (hs) details.location = hs.location;
    } else if (booking.service_type === 'package') {
      const { data: pkg } = await supabase.from('packages').select('route').eq('id', booking.service_id).single();
      if (pkg) details.location = pkg.route;
    } else if (booking.service_type === 'transport') {
      const { data: tr } = await supabase.from('transports').select('route_from, route_to').eq('id', booking.service_id).single();
      if (tr) details.location = `${tr.route_from} to ${tr.route_to}`;
    } else if (booking.service_type === 'guide') {
      const { data: g } = await supabase.from('guides').select('location').eq('id', booking.service_id).single();
      if (g && (g as any).location) details.location = (g as any).location;
    }

    // Send confirmation email asynchronously
    if (userProfile && userProfile.email) {
      sendBookingEmail(userProfile.email, updatedBooking, userProfile, details).catch(err => {
        console.error('Failed to send booking confirmation email:', err);
      });
    }

    if (userId) {
      createNotification(
        userId,
        'Booking Confirmed',
        `Your booking for ${updatedBooking.service_name || 'your service'} is confirmed!`,
        'booking',
        'fas fa-check-circle text-green-500',
        '/dashboard/user/bookings'
      );
    }

    return res.status(200).json(updatedBooking);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/v1/bookings/:id/cancel
export const cancelBooking = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    const { data: booking, error: fetchError } = await adminSupabase
      .from('bookings')
      .select('user_id, status, payment_status, total_amount, check_in, razorpay_payment_id, service_type, service_id')
      .eq('id', id)
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
        return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled booking' });
    }

    let refundAmount = 0;
    
    // Calculate Refund if payment was made
    if (booking.payment_status === 'paid') {
      let policy: { days_before: number, refund_percentage: number }[] = [];
      
      // 1. Try to fetch provider-specific policy
      let tableName = '';
      if (booking.service_type === 'homestay') tableName = 'homestays';
      else if (booking.service_type === 'guide') tableName = 'guides';
      else if (booking.service_type === 'transport') tableName = 'transports';
      else if (booking.service_type === 'package') tableName = 'packages';

      if (tableName && booking.service_id) {
          const { data: serviceData } = await adminSupabase.from(tableName).select('cancellation_policy').eq('id', booking.service_id).single();
          if (serviceData?.cancellation_policy && Array.isArray(serviceData.cancellation_policy) && serviceData.cancellation_policy.length > 0) {
              policy = serviceData.cancellation_policy;
          }
      }

      // 2. Fallback to global policy if no provider-specific policy exists
      if (policy.length === 0) {
        const { data: settings } = await adminSupabase.from('system_settings').select('value').eq('key', 'cancellation_policy').single();
        policy = settings?.value as { days_before: number, refund_percentage: number }[] || [];
      }
      
      let refundPercentage = 0;
      if (booking.check_in) {
        const diffMs = new Date(booking.check_in).getTime() - new Date().getTime();
        const daysBefore = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        // Find the applicable policy (sort by days_before descending)
        const sortedPolicy = [...policy].sort((a, b) => b.days_before - a.days_before);
        for (const p of sortedPolicy) {
          if (daysBefore >= p.days_before) {
            refundPercentage = p.refund_percentage;
            break;
          }
        }
      }
      refundAmount = (Number(booking.total_amount) * refundPercentage) / 100;
    }

    // Cancel the booking
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Create refund request if applicable
    if (refundAmount > 0 && booking.razorpay_payment_id) {
      await adminSupabase.from('refunds').insert({
        booking_id: id,
        user_id: userId,
        amount: refundAmount,
        razorpay_payment_id: booking.razorpay_payment_id,
        status: 'pending',
        reason: 'User cancelled booking'
      });
    }

    if (userId) {
      createNotification(
        userId,
        'Booking Cancelled',
        refundAmount > 0 ? `Your booking has been cancelled. A refund of ₹${refundAmount} is pending approval.` : `Your booking has been cancelled.`,
        'booking',
        'fas fa-times-circle text-red-500',
        '/dashboard/user/bookings'
      );
    }

    return res.status(200).json({ ...data, refundAmount });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Admin Endpoints ---

// GET /api/v1/bookings (List all bookings)
export const getAllBookings = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Fetch user profiles to map customer details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, custom_id, name, email, phone');

    const userMap = new Map((users || []).map(u => [u.id, u]));

    const enrichedBookings = (data || []).map(booking => {
      const u = userMap.get(booking.user_id);
      let derivedStatus = booking.status;
      if (booking.status === 'confirmed' && booking.checked_in_at && !booking.checked_out_at) {
        derivedStatus = 'checked_in';
      }
      
      let offlineName = null;
      if (booking.notes && typeof booking.notes === 'string') {
          const match = booking.notes.match(/Name:\s*(.*?)\s*\|/);
          if (match && match[1]) offlineName = match[1].trim();
      }

      return {
        ...booking,
        status: derivedStatus,
        guest_name: offlineName || u?.name || 'Guest',
        guest_email: u?.email || '',
        guest_phone: u?.phone || '',
      };
    });

    return res.status(200).json(enrichedBookings);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/v1/bookings/:id/status (Admin/Provider updates booking status)
export const updateBookingStatus = async (req: Request, res: Response) => {
  const supabase = adminSupabase; // Use adminSupabase to bypass RLS, we handle auth manually
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.user_id;
    const role = req.user?.role;

    let booking: any = null;

    if (role === 'provider') {
      const { data: b, error: fetchError } = await supabase
        .from('bookings')
        .select('service_type, service_id, payment_status')
        .eq('id', id)
        .single();
      
      booking = b;
        
      if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });

      let ownsService = false;
      if (booking.service_type === 'homestay') {
        const { data } = await supabase.from('homestays').select('id').eq('id', booking.service_id).eq('host_id', userId).single();
        if (data) ownsService = true;
      } else if (booking.service_type === 'transport') {
        const { data } = await supabase.from('transports').select('id').eq('id', booking.service_id).eq('provider_id', userId).single();
        if (data) ownsService = true;
      } else if (booking.service_type === 'guide') {
        const { data } = await supabase.from('guides').select('id').eq('id', booking.service_id).eq('user_id', userId).single();
        if (data) ownsService = true;
      }

      if (!ownsService) {
        return res.status(403).json({ error: 'Forbidden: You do not own this service' });
      }
    } else {
      // If admin, we still need to fetch booking to check payment status for check-in
      const { data: b } = await supabase.from('bookings').select('payment_status').eq('id', id).single();
      booking = b;
    }

    let updatePayload: any = { status };
    if (status === 'checked_in' || status === 'in_progress') {
      if (booking && booking.payment_status !== 'paid' && booking.payment_status !== 'partially_paid') {
        return res.status(400).json({ error: 'Cannot check-in. Payment is still pending. Please clear all dues.' });
      }
      updatePayload = { status: 'confirmed', checked_in_at: new Date().toISOString() };
    } else if (status === 'confirmed') {
      updatePayload = { status: 'confirmed', checked_in_at: null, checked_out_at: null };
    } else if (status === 'completed') {
      updatePayload = { status: 'completed', checked_out_at: new Date().toISOString() };
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (data.user_id) {
      createNotification(
        data.user_id,
        'Booking Status Updated',
        `Your booking status was updated to ${status.replace('_', ' ')}.`,
        'booking',
        'fas fa-info-circle text-orange-500',
        '/dashboard/user/bookings'
      );
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('updateBookingStatus error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Provider Endpoints ---

// GET /api/v1/bookings/provider (Bookings for the provider's own services)
export const getProviderBookings = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;

    // Collect all service IDs owned by this provider across all service types
    const serviceIds: string[] = [];

    const [homestays, transports, guides] = await Promise.all([
      supabase.from('homestays').select('id').eq('host_id', userId),
      supabase.from('transports').select('id').eq('provider_id', userId),
      supabase.from('guides').select('id').eq('user_id', userId),
    ]);

    if (homestays.data) serviceIds.push(...homestays.data.map((h: any) => h.id));
    if (transports.data) serviceIds.push(...transports.data.map((t: any) => t.id));
    if (guides.data) serviceIds.push(...guides.data.map((g: any) => g.id));

    if (serviceIds.length === 0) {
      return res.status(200).json([]);
    }

    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await adminSupabase
      .from('bookings')
      .select('*')
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Enrich with guest contact info
    const userIds = [...new Set((data || []).map(b => b.user_id).filter(Boolean))];
    let userMap = new Map();
    if (userIds.length > 0) {
      const { data: users } = await adminSupabase
        .from('users')
        .select('id, custom_id, name, email, phone')
        .in('id', userIds);
      userMap = new Map((users || []).map(u => [u.id, u]));
    }

    const enriched = (data || []).map(booking => {
      const guest = userMap.get(booking.user_id);
      let derivedStatus = booking.status;
      if (booking.status === 'confirmed' && booking.checked_in_at && !booking.checked_out_at) {
        derivedStatus = 'checked_in';
      }
      
      let offlineName = null;
      if (booking.notes && typeof booking.notes === 'string') {
          const match = booking.notes.match(/Name:\s*(.*?)\s*\|/);
          if (match && match[1]) offlineName = match[1].trim();
      }

      return {
        ...booking,
        status: derivedStatus,
        guest_name: offlineName || guest?.name || 'Guest',
        guest_email: guest?.email || '',
        guest_phone: guest?.phone || '',
      };
    });

    return res.status(200).json(enriched);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/v1/bookings/:id/allot-rooms
export const allotRooms = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const { allotted_rooms } = req.body;
    const userId = req.user?.user_id;

    if (allotted_rooms === undefined) {
      return res.status(400).json({ error: 'allotted_rooms is required' });
    }

    // Verify booking and check provider ownership
    const { data: booking, error: fetchError } = await adminSupabase
      .from('bookings')
      .select('id, service_id, service_type')
      .eq('id', id)
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });

    let isOwner = false;
    if (booking.service_type === 'homestay') {
      const { data: hs } = await adminSupabase.from('homestays').select('host_id').eq('id', booking.service_id).single();
      if (hs && hs.host_id === userId) isOwner = true;
    }

    if (!isOwner && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ allotted_rooms })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
