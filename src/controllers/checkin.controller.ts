import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

// Helper: only include `id.eq.` in the OR filter when token is a valid UUID,
// otherwise PostgreSQL throws a type-cast error on the uuid column.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const buildTokenFilter = (token: string): string => {
  // ── SEC-02 FIX: Sanitize token to prevent PostgREST filter injection ──
  // Only allow alphanumeric, hyphens, and underscores (safe for UUIDs and custom IDs)
  const cleanToken = token.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!cleanToken) {
    throw new Error('Invalid token format');
  }
  const parts = [`custom_id.ilike.${cleanToken}`];
  if (UUID_RE.test(cleanToken)) {
    parts.push(`id.eq.${cleanToken}`);
    parts.push(`checkin_token.eq.${cleanToken}`);
  }
  return parts.join(',');
};

// GET /api/v1/checkin/token/:bookingId
export const getCheckinToken = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { bookingId } = req.params;
    const userId = req.user?.user_id;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, checkin_token, user_id, status')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json({ checkin_token: booking.checkin_token });
  } catch (error: any) {
    console.error('[Checkin Controller Error]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/checkin/scan
export const scanQrCode = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { token } = req.body;
    const providerId = req.user?.user_id;

    if (!token) return res.status(400).json({ error: 'Token is required' });

    // Find booking by token or ID using adminSupabase to bypass RLS (provider doesn't own the booking)
    const { data: booking, error } = await adminSupabase
      .from('bookings')
      .select('*')
      .or(buildTokenFilter(token))
      .single();

    if (error || !booking) {
      if (error) console.error('[Checkin Find Error]', error);
      return res.status(404).json({ error: 'Invalid QR code or booking not found' });
    }

    let guestName = 'Guest';
    if (booking.user_id) {
      const { data: user } = await adminSupabase.from('users').select('name').eq('id', booking.user_id).single();
      if (user && user.name) guestName = user.name;
    }

    // Verify provider owns this service (Homestay logic only for now, could be expanded to transport/guide)
    if (booking.service_type === 'homestay') {
      const { data: homestay } = await supabase
        .from('homestays')
        .select('id')
        .eq('id', booking.service_id)
        .eq('host_id', providerId)
        .single();
        
      if (!homestay) {
         // Maybe the user is an admin?
         if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
           return res.status(403).json({ error: 'You do not own the homestay for this booking.' });
         }
      }
    } else {
        // Not a homestay booking
        return res.status(400).json({ error: 'QR Check-in is only supported for homestays currently.' });
    }

    return res.status(200).json({
      id: booking.id,
      custom_id: booking.custom_id,
      service_name: booking.service_name,
      guest_name: guestName,
      check_in: booking.check_in,
      check_out: booking.check_out,
      guests: booking.guests,
      total_amount: booking.total_amount,
      status: booking.status,
      payment_status: booking.payment_status,
      checked_in_at: booking.checked_in_at,
      checked_out_at: booking.checked_out_at,
      checkin_token: booking.checkin_token // Return token so subsequent requests work if ID was typed
    });
  } catch (error: any) {
    console.error('[Checkin Controller Error]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/checkin/cash-payment
export const confirmCashPayment = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { token, note } = req.body;
    const providerId = req.user?.user_id;

    // Verify ownership indirectly by fetching booking first with adminSupabase
    const { data: booking, error: fetchError } = await adminSupabase
      .from('bookings')
      .select('id, service_id, payment_status, service_type')
      .or(buildTokenFilter(token))
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.payment_status === 'paid') return res.status(400).json({ error: 'Booking is already paid' });

    // Verify provider
    if (booking.service_type === 'homestay') {
      const { data: homestay } = await supabase
        .from('homestays')
        .select('id')
        .eq('id', booking.service_id)
        .eq('host_id', providerId)
        .single();
      if (!homestay && req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: updatedBooking, error } = await adminSupabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        cash_payment_confirmed_by: providerId,
        cash_payment_note: note || null
      })
      .eq('id', booking.id)
      .select('id, payment_status')
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, booking: updatedBooking });
  } catch (error: any) {
    console.error('[Checkin Controller Error]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/checkin/confirm
export const confirmCheckin = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { token } = req.body;
    const providerId = req.user?.user_id;

    const { data: booking, error: fetchError } = await adminSupabase
      .from('bookings')
      .select('id, service_id, payment_status, checked_in_at, service_type')
      .or(buildTokenFilter(token))
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
    
    // Payment gating
    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Cannot check-in. Payment is still pending.' });
    }

    if (booking.checked_in_at) {
      return res.status(400).json({ error: 'Guest is already checked in.' });
    }

    // Verify provider
    if (booking.service_type === 'homestay') {
      const { data: homestay } = await supabase
        .from('homestays')
        .select('id')
        .eq('id', booking.service_id)
        .eq('host_id', providerId)
        .single();
      if (!homestay && req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: updatedBooking, error } = await adminSupabase
      .from('bookings')
      .update({
        checked_in_at: new Date().toISOString()
      })
      .eq('id', booking.id)
      .select('id, status, checked_in_at')
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, booking: updatedBooking });
  } catch (error: any) {
    console.error('[Checkin Controller Error]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/checkin/checkout
export const confirmCheckout = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { token } = req.body;
    const providerId = req.user?.user_id;

    const { data: booking, error: fetchError } = await adminSupabase
      .from('bookings')
      .select('id, service_id, checked_in_at, checked_out_at, service_type')
      .or(buildTokenFilter(token))
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
    
    if (!booking.checked_in_at) {
      return res.status(400).json({ error: 'Cannot check-out. Guest has not checked in yet.' });
    }

    if (booking.checked_out_at) {
      return res.status(400).json({ error: 'Guest is already checked out.' });
    }

    // Verify provider
    if (booking.service_type === 'homestay') {
      const { data: homestay } = await supabase
        .from('homestays')
        .select('id')
        .eq('id', booking.service_id)
        .eq('host_id', providerId)
        .single();
      if (!homestay && req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: updatedBooking, error } = await adminSupabase
      .from('bookings')
      .update({
        checked_out_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', booking.id)
      .select('id, status, checked_out_at')
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, booking: updatedBooking });
  } catch (error: any) {
    console.error('[Checkin Controller Error]', error?.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
