import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

// GET /api/v1/finance/overview
export const getFinancialOverview = async (req: Request, res: Response) => {
  try {
    // Requires admin privileges
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const { data: payoutsData, error: payoutsError } = await adminSupabase
      .from('payouts')
      .select('*');

    if (payoutsError) throw payoutsError;

    const payouts = payoutsData || [];

    let totalPlatformCommission = 0;
    let totalPendingPayouts = 0;
    let totalPaidOut = 0;

    for (const p of payouts) {
      totalPlatformCommission += Number(p.commission_amount) || 0;
      if (p.status === 'pending' || p.status === 'processing') {
        totalPendingPayouts += Number(p.amount) || 0;
      } else if (p.status === 'paid') {
        totalPaidOut += Number(p.amount) || 0;
      }
    }

    const { data: transactionsData, error: transactionsError } = await adminSupabase
      .from('transactions')
      .select('amount, type');

    if (transactionsError) throw transactionsError;

    let grossBookingValue = 0;
    for (const t of (transactionsData || [])) {
      if (t.type === 'payment_received') {
        grossBookingValue += Number(t.amount) || 0;
      }
    }

    return res.status(200).json({
      overview: {
        grossBookingValue,
        totalPlatformCommission,
        totalPendingPayouts,
        totalPaidOut,
      }
    });
  } catch (error: any) {
    console.error('Finance overview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/finance/transactions?page=1&limit=20
export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const { data, count, error } = await adminSupabase
      .from('transactions')
      .select('*, users!user_id(name, email), provider:users!provider_id(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.status(200).json({
      transactions: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      }
    });
  } catch (error: any) {
    console.error('Transactions fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/finance/payouts?status=pending&page=1&limit=20
export const getPayouts = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let query = adminSupabase
      .from('payouts')
      .select('*, provider:users!provider_id(name, email, phone), bookings(service_name, total_amount)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.status(200).json({
      payouts: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      }
    });
  } catch (error: any) {
    console.error('Payouts fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/v1/finance/payouts/:id/mark-paid
export const processPayout = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const payoutId = req.params.id;
    const { reference_no, receipt_url } = req.body;

    if (!reference_no) {
      return res.status(400).json({ error: 'reference_no is required' });
    }

    const { data, error } = await adminSupabase
      .from('payouts')
      .update({
        status: 'paid',
        reference_no,
        receipt_url,
        paid_at: new Date().toISOString()
      })
      .eq('id', payoutId)
      .select()
      .single();

    if (error) throw error;

    // Log this payout processing as a transaction in the ledger
    if (data) {
       await adminSupabase.from('transactions').insert({
         provider_id: data.provider_id,
         booking_id: data.booking_id,
         amount: data.amount,
         type: 'payout_processed',
         status: 'completed',
         reference_no
       });

       // Sync the booking table's payout_status so the provider dashboard reflects it
       if (data.booking_id) {
         await adminSupabase.from('bookings').update({
           payout_status: 'paid_out',
           payout_date: new Date().toISOString()
         }).eq('id', data.booking_id);
       }
    }

    return res.status(200).json({ message: 'Payout marked as paid', payout: data });
  } catch (error: any) {
    console.error('Process payout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
