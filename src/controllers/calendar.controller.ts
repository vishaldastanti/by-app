import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

/**
 * Helper: get all service IDs owned by a provider
 */
async function getProviderServiceIds(userId: string, supabase: any): Promise<{ type: string; id: string }[]> {
  const results: { type: string; id: string }[] = [];

  const [homestays, transports, guides] = await Promise.all([
    supabase.from('homestays').select('id').eq('host_id', userId),
    supabase.from('transports').select('id').eq('provider_id', userId),
    supabase.from('guides').select('id').eq('user_id', userId),
  ]);

  if (homestays.data) results.push(...homestays.data.map((h: any) => ({ type: 'homestay', id: h.id })));
  if (transports.data) results.push(...transports.data.map((t: any) => ({ type: 'transport', id: t.id })));
  if (guides.data) results.push(...guides.data.map((g: any) => ({ type: 'guide', id: g.id })));

  return results;
}

// GET /api/v1/provider/calendar?month=2026-06&service_id=xxx
// Returns merged array of booked dates and manually blocked dates
export const getProviderCalendar = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { month, service_id } = req.query;

    // Get all service IDs owned by this provider
    const services = await getProviderServiceIds(userId, supabase);
    if (services.length === 0) {
      return res.status(200).json({ booked_dates: [], blocked_dates: [], services: [] });
    }

    const serviceIds = service_id ? [service_id as string] : services.map(s => s.id);

    // Verify provider owns the requested service_id
    if (service_id && !services.some(s => s.id === service_id)) {
      return res.status(403).json({ error: 'You do not own this service' });
    }

    // Calculate date range for the month (or default to current month)
    let startDate: string;
    let endDate: string;
    if (month && typeof month === 'string') {
      startDate = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    // Fetch booked dates (confirmed/in_progress bookings within the date range)
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, custom_id, service_id, service_name, check_in, check_out, guests, status, total_amount, booked_rooms')
      .in('service_id', serviceIds)
      .in('status', ['confirmed', 'in_progress'])
      .gte('check_in', startDate)
      .lte('check_in', endDate);

    if (bookingsError) throw bookingsError;

    // Fetch total rooms if service_id is provided
    let totalRooms = 1;
    if (service_id) {
      const { data: hs } = await adminSupabase.from('homestays').select('number_of_rooms').eq('id', service_id).single();
      if (hs && hs.number_of_rooms) totalRooms = hs.number_of_rooms;
    }

    // Expand booked date ranges into individual dates
    const bookedDates: { date: string; booking_id: string; service_id: string; service_name: string; guests: number; status: string }[] = [];
    const bookedInfoMap: Record<string, number> = {};

    for (const booking of bookings || []) {
      if (!booking.check_in) continue;
      const checkIn = new Date(booking.check_in);
      const checkOut = booking.check_out ? new Date(booking.check_out) : new Date(checkIn.getTime() + 86400000);
      const rooms = booking.booked_rooms || 1;
      
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        // Use local date methods to format consistently regardless of server timezone
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        bookedDates.push({
          date: dateStr,
          booking_id: booking.id,
          service_id: booking.service_id,
          service_name: booking.service_name || '',
          guests: booking.guests || 1,
          status: booking.status,
        });

        bookedInfoMap[dateStr] = (bookedInfoMap[dateStr] || 0) + rooms;
      }
    }

    const booked_dates_info = Object.keys(bookedInfoMap).map(date => ({
      date,
      booked_rooms: bookedInfoMap[date],
      total_rooms: totalRooms,
      rooms_left: totalRooms - bookedInfoMap[date]
    }));

    // Fetch manually blocked dates
    const { data: blockedDates, error: blockedError } = await supabase
      .from('provider_blocked_dates')
      .select('id, service_id, blocked_date, reason, created_at')
      .in('service_id', serviceIds)
      .gte('blocked_date', startDate)
      .lte('blocked_date', endDate);

    if (blockedError) throw blockedError;

    return res.status(200).json({
      booked_dates: bookedDates,
      booked_dates_info,
      total_rooms: totalRooms,
      blocked_dates: (blockedDates || []).map(b => ({
        id: b.id,
        date: b.blocked_date,
        service_id: b.service_id,
        reason: b.reason,
      })),
      services,
    });
  } catch (error: any) {
    console.error('Calendar fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/provider/calendar/block
// Block a date or date range for a service
export const blockDates = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { service_id, service_type, dates, reason } = req.body;

    if (!service_id || !service_type || !dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'service_id, service_type, and dates[] are required' });
    }

    // Verify provider owns this service
    const services = await getProviderServiceIds(userId, supabase);
    if (!services.some(s => s.id === service_id)) {
      return res.status(403).json({ error: 'You do not own this service' });
    }

    // Check that none of the dates conflict with confirmed bookings
    const { data: conflicting } = await supabase
      .from('bookings')
      .select('check_in, check_out')
      .eq('service_id', service_id)
      .in('status', ['confirmed', 'in_progress']);

    const bookedDateSet = new Set<string>();
    for (const b of conflicting || []) {
      if (!b.check_in) continue;
      const checkIn = new Date(b.check_in);
      const checkOut = b.check_out ? new Date(b.check_out) : new Date(checkIn.getTime() + 86400000);
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        bookedDateSet.add(d.toISOString().slice(0, 10));
      }
    }

    const conflictingDates = dates.filter((d: string) => bookedDateSet.has(d));
    if (conflictingDates.length > 0) {
      return res.status(409).json({
        error: 'Cannot block dates with existing bookings',
        conflicting_dates: conflictingDates,
      });
    }

    const validDates = dates.filter((d: string) => d && d.trim() !== '');
    if (validDates.length === 0) {
      return res.status(400).json({ error: 'Valid dates are required' });
    }

    const rows = validDates.map((d: string) => ({
      provider_id: userId,
      service_type,
      service_id,
      blocked_date: d,
      reason: reason || 'unavailable',
    }));

    const { data, error } = await supabase
      .from('provider_blocked_dates')
      .upsert(rows, { onConflict: 'service_id,blocked_date' })
      .select();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Block dates error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/v1/provider/calendar/unblock
// Unblock a date for a service
export const unblockDates = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { service_id, dates } = req.body;

    if (!service_id || !dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'service_id and dates[] are required' });
    }

    // Verify provider owns this service
    const services = await getProviderServiceIds(userId, supabase);
    if (!services.some(s => s.id === service_id)) {
      return res.status(403).json({ error: 'You do not own this service' });
    }

    const validDates = dates.filter((d: string) => d && d.trim() !== '');
    if (validDates.length === 0) {
      return res.status(400).json({ error: 'Valid dates are required' });
    }

    const { error } = await supabase
      .from('provider_blocked_dates')
      .delete()
      .eq('provider_id', userId)
      .eq('service_id', service_id)
      .in('blocked_date', validDates);

    if (error) throw error;
    return res.status(200).json({ message: 'Dates unblocked successfully' });
  } catch (error: any) {
    console.error('Unblock dates error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
