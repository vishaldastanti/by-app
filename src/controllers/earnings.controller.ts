import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

const PLATFORM_COMMISSION_RATE = 0; // 0% BiharYaatra commission

// GET /api/v1/provider/earnings?page=1&limit=20
// Returns earnings summary + paginated historical ledger
export const getProviderEarnings = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Collect all service IDs owned by this provider
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
      return res.status(200).json({
        summary: { pending_escrow: 0, available_withdrawal: 0, total_earned: 0, total_commission: 0 },
        ledger: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
      });
    }

    // Fetch ALL bookings for this provider's services (for summary calculations)
    const { data: allBookings, error: allError } = await supabase
      .from('bookings')
      .select('id, custom_id, service_type, service_name, total_amount, status, payment_status, payout_status, payout_date, razorpay_payment_id, razorpay_order_id, created_at, check_in, check_out')
      .in('service_id', serviceIds)
      .in('status', ['confirmed', 'in_progress', 'completed'])
      .order('created_at', { ascending: false });

    if (allError) throw allError;

    const bookings = allBookings || [];

    // Calculate summary
    let pendingEscrow = 0;    // Confirmed + in_progress (money held)
    let availableWithdrawal = 0; // Completed BUT NOT paid out (money cleared)
    let totalPaidOut = 0; // Completed AND paid out
    let totalEarned = 0;
    let totalCommission = 0;

    for (const b of bookings) {
      const amount = Number(b.total_amount) || 0;
      const commission = Math.round(amount * PLATFORM_COMMISSION_RATE * 100) / 100;
      const netAmount = amount - commission;

      if (b.status === 'confirmed' || b.status === 'in_progress') {
        pendingEscrow += netAmount;
      } else if (b.status === 'completed') {
        totalEarned += netAmount;
        totalCommission += commission;

        if (b.payout_status === 'paid_out') {
          totalPaidOut += netAmount;
        } else {
          availableWithdrawal += netAmount;
        }
      }
    }

    // Fetch paginated ledger (completed bookings for the historical table)
    const { data: ledgerData, error: ledgerError, count } = await supabase
      .from('bookings')
      .select('id, custom_id, user_id, service_type, service_name, total_amount, status, payment_status, payout_status, payout_date, razorpay_payment_id, razorpay_order_id, created_at, check_in, check_out', { count: 'exact' })
      .in('service_id', serviceIds)
      .in('status', ['completed', 'confirmed', 'in_progress'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ledgerError) throw ledgerError;

    // Fetch guest info
    const userIds = [...new Set((ledgerData || []).map(b => b.user_id).filter(Boolean))];
    let userMap = new Map();
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name, email, phone').in('id', userIds);
      userMap = new Map((users || []).map(u => [u.id, u]));
    }

    const ledger = (ledgerData || []).map(b => {
      const grossAmount = Number(b.total_amount) || 0;
      const platformFee = Math.round(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
      const netPayout = grossAmount - platformFee;
      const guest = userMap.get(b.user_id);

      return {
        id: b.id,
        custom_id: b.custom_id,
        date: b.created_at,
        service_type: b.service_type,
        service_name: b.service_name || `${b.service_type} booking`,
        guest_name: guest?.name || 'Guest',
        guest_email: guest?.email || '',
        guest_phone: guest?.phone || '',
        check_in: b.check_in,
        check_out: b.check_out,
        gross_amount: grossAmount,
        platform_fee: platformFee,
        commission_rate: `${PLATFORM_COMMISSION_RATE * 100}%`,
        net_payout: netPayout,
        payment_status: b.payment_status,
        payout_status: b.payout_status || 'pending',
        payout_date: b.payout_date || null,
        booking_status: b.status,
        razorpay_payment_id: b.razorpay_payment_id || null,
        razorpay_order_id: b.razorpay_order_id || null,
      };
    });

    const totalRecords = count || 0;

    return res.status(200).json({
      summary: {
        pending_escrow: Math.round(pendingEscrow * 100) / 100,
        available_withdrawal: Math.round(availableWithdrawal * 100) / 100,
        total_paid_out: Math.round(totalPaidOut * 100) / 100,
        total_earned: Math.round(totalEarned * 100) / 100,
        total_commission: Math.round(totalCommission * 100) / 100,
        commission_rate: `${PLATFORM_COMMISSION_RATE * 100}%`,
      },
      ledger,
      pagination: {
        page,
        limit,
        total: totalRecords,
        total_pages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error: any) {
    console.error('Earnings fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/provider/earnings/request-payout
export const requestPayout = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { booking_id } = req.body;

    // Collect all service IDs owned by this provider
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
      return res.status(400).json({ error: 'No active services found.' });
    }

    let query = supabase
      .from('bookings')
      .select('id, total_amount, payout_status')
      .in('service_id', serviceIds)
      .eq('status', 'completed')
      .or('payout_status.is.null,payout_status.eq.pending');

    if (booking_id) {
      query = query.eq('id', booking_id);
    }

    const { data: eligibleBookings, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!eligibleBookings || eligibleBookings.length === 0) {
      return res.status(400).json({ error: 'No eligible bookings found for payout.' });
    }

    const payoutInserts = eligibleBookings.map((b: any) => {
      const amount = Number(b.total_amount) || 0;
      const commission = Math.round(amount * PLATFORM_COMMISSION_RATE * 100) / 100;
      const netAmount = amount - commission;

      return {
        provider_id: userId,
        booking_id: b.id,
        amount: netAmount,
        commission_amount: commission,
        status: 'pending'
      };
    });

    // We need adminSupabase to insert into payouts table to bypass RLS if it's restrictive, 
    // but providers should have insert access if they request their own. 
    // Actually, RLS on payouts might not allow providers to insert. Let's use adminSupabase just in case.
    const { error: insertError } = await adminSupabase.from('payouts').insert(payoutInserts);
    if (insertError) throw insertError;

    // Update bookings
    const bookingIdsToUpdate = eligibleBookings.map((b: any) => b.id);
    const { error: updateError } = await adminSupabase
      .from('bookings')
      .update({ payout_status: 'processing' })
      .in('id', bookingIdsToUpdate);

    if (updateError) throw updateError;

    return res.status(200).json({ 
      message: `Successfully requested payout for ${bookingIdsToUpdate.length} booking(s).`,
      count: bookingIdsToUpdate.length
    });
  } catch (error: any) {
    console.error('Request payout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
