import { Request, Response } from 'express';
import crypto from 'crypto';
import { razorpay, RAZORPAY_WEBHOOK_SECRET } from '../config/razorpay';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { sendBookingEmail } from '../services/email.service';
import { env } from '../config/env';

// POST /api/v1/payments/create-order
export const createOrder = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { currency = 'INR', booking_id, payment_type = 'full' } = req.body;
    const userId = req.user?.user_id;

    // Verify booking belongs to user
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (booking.payment_status === 'paid') return res.status(400).json({ error: 'Booking already paid' });

    // ── PRIORITY CHECK: Re-verify availability to prevent double booking ──
    if (booking.check_in && booking.status === 'pending') {
      let endDate = booking.check_out;
      if (!endDate) {
        const nextDay = new Date(booking.check_in);
        nextDay.setDate(nextDay.getDate() + 1);
        endDate = nextDay.toISOString().slice(0, 10);
      }

      const { data: existingBookings, error: bookingsError } = await adminSupabase
        .from('bookings')
        .select('id, booked_rooms')
        .eq('service_id', booking.service_id)
        .in('status', ['confirmed', 'in_progress'])
        .gte('check_in', booking.check_in)
        .lt('check_in', endDate);

      if (!bookingsError) {
        const bookedRoomsSum = existingBookings?.reduce((sum, b) => sum + (b.booked_rooms || 1), 0) || 0;
        const requestedRooms = booking.booked_rooms || 1;

        let maxRooms = 1;
        if (booking.service_type === 'homestay') {
            const { data: hs } = await adminSupabase.from('homestays').select('number_of_rooms').eq('id', booking.service_id).single();
            if (hs && hs.number_of_rooms) maxRooms = hs.number_of_rooms;
        }

        if (bookedRoomsSum + requestedRooms > maxRooms) {
          // The slot was taken by someone else who paid first!
          // Auto-cancel this pending booking.
          await adminSupabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
          return res.status(409).json({ error: 'This slot was just claimed by another user and is no longer available.' });
        }
      }
    }

    // ── CRIT-4 FIX: Security - Do not trust 'amount' from client ──
    const totalAmountInPaise = Math.round(Number(booking.total_amount) * 100);

    // For advance payments (Pay at Location), charge only 20%
    const amountInPaise = payment_type === 'advance'
      ? Math.round(totalAmountInPaise * 0.20)
      : totalAmountInPaise;

    // Create Razorpay order
    const options = {
      amount: amountInPaise,
      currency,
      receipt: booking_id, // Use booking ID as receipt
      notes: {
        booking_id,
        payment_type, // 'full' or 'advance'
      },
    };

    const order = await razorpay.orders.create(options);
    return res.status(200).json(order);
  } catch (error: any) {
    console.error('Razorpay order creation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/payments/webhook
export const webhook = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    // ── CRIT-1 FIX: Razorpay webhook HMAC verification using raw body buffer ──
    // The raw body is preserved because server.ts registers express.raw() on this path
    // BEFORE express.json(), so req.body is a Buffer here.
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
    }

    // req.body is a raw Buffer here (not parsed JSON) thanks to express.raw()
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // ── MED-1 FIX: Use timing-safe comparison to prevent timing attacks ──
    const isValid = expectedSignature.length === signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      );

    if (!isValid) {
      console.warn('Razorpay webhook: Invalid HMAC signature rejected.');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Parse the verified raw body
    const payload = JSON.parse(rawBody.toString());
    const { event } = payload;

    if (event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      const bookingId = payment.notes?.booking_id;
      const paymentType = payment.notes?.payment_type || 'full';

      console.log(`Payment captured for order: ${orderId}, booking: ${bookingId}, type: ${paymentType}`);

      if (bookingId) {
        // For advance payments (20%), mark as partially_paid; for full payments, mark as paid
        const isAdvance = paymentType === 'advance';
        const advanceAmount = isAdvance ? Math.round(payment.amount / 100) : undefined;

        const updateData: any = {
          payment_status: isAdvance ? 'partially_paid' : 'paid',
          status: 'confirmed',
          razorpay_payment_id: payment.id,
          razorpay_order_id: orderId,
        };
        if (isAdvance && advanceAmount) {
          updateData.advance_amount = advanceAmount;
        }

        const { error: updateError } = await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', bookingId);
        
        if (updateError) {
          console.error('Failed to update booking after payment capture:', updateError);
        } else {
          console.log(`Booking ${bookingId} marked as ${isAdvance ? 'partially_paid' : 'paid'} and confirmed.`);
        }
      } else {
        console.warn('Payment captured but no booking_id found in payment notes.');
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/payments/verify
export const verifyPayment = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id } = req.body;
    const userId = req.user?.user_id;

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    // Verify signature
    const secret = env.RAZORPAY_KEY_SECRET;
    const text = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    // ── MED-1 FIX: Timing-safe HMAC comparison ──
    let isMatch = false;
    try {
      isMatch = expectedSignature.length === razorpay_signature.length &&
        crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(razorpay_signature, 'hex')
        );
    } catch {
      isMatch = false;
    }

    // ── CRIT-2 FIX: REJECT the request if signature doesn't match ──
    if (!isMatch) {
      console.warn(`Razorpay verify: Signature mismatch for booking ${booking_id}.`);
      return res.status(400).json({ error: 'Payment verification failed: invalid signature' });
    }

    // Fetch the Razorpay order to securely determine payment_type from notes
    let paymentType = 'full';
    try {
      const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
      paymentType = (rzpOrder as any).notes?.payment_type || 'full';
    } catch (fetchErr) {
      console.warn('Could not fetch Razorpay order to determine payment_type, defaulting to full:', fetchErr);
    }

    const isAdvance = paymentType === 'advance';
    const updateData: any = {
      payment_status: isAdvance ? 'partially_paid' : 'paid',
      status: 'confirmed',
      razorpay_payment_id,
      razorpay_order_id,
    };

    // Store the advance amount (20% of total) for advance payments
    if (isAdvance) {
      updateData.advance_amount = Math.round(Number(booking.total_amount) * 0.20);
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

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

    return res.status(200).json(updatedBooking);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

