import { Request, Response } from 'express';
import { adminSupabase } from '../config/supabase';
import { razorpay } from '../config/razorpay';
import { createNotification } from '../services/notification.service';
import { sendRefundEmail } from '../services/email.service';

// GET /api/v1/refunds (Admin only)
export const getPendingRefunds = async (req: Request, res: Response) => {
  try {
    const { data, error } = await adminSupabase
      .from('refunds')
      .select('*, bookings(custom_id, service_name), users(name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/refunds/:id/approve (Admin only)
export const approveRefund = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: refund, error: fetchError } = await adminSupabase
      .from('refunds')
      .select('*, bookings(user_id, custom_id, service_name)')
      .eq('id', id)
      .single();

    if (fetchError || !refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status !== 'pending') return res.status(400).json({ error: `Refund is already ${refund.status}` });

    // Call Razorpay API
    let razorpay_refund_id = null;
    try {
      const rzpRefund = await razorpay.payments.refund(refund.razorpay_payment_id, {
        amount: Math.round(Number(refund.amount) * 100), // in paise
        notes: {
          refund_id: refund.id,
          booking_id: refund.booking_id
        }
      });
      razorpay_refund_id = rzpRefund.id;
    } catch (rzpError: any) {
      console.error('Razorpay Refund Error:', rzpError);
      return res.status(400).json({ error: 'Razorpay refund failed', details: rzpError });
    }

    // Update refund status
    const { data: updatedRefund, error: updateError } = await adminSupabase
      .from('refunds')
      .update({
        status: 'processed',
        razorpay_refund_id
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log transaction
    await adminSupabase.from('transactions').insert({
      booking_id: refund.booking_id,
      user_id: refund.user_id,
      amount: refund.amount,
      type: 'refund',
      status: 'completed',
      reference_no: razorpay_refund_id
    });

    // Notify User
    if (refund.user_id) {
      createNotification(
        refund.user_id,
        'Refund Processed',
        `Your refund of ₹${refund.amount} has been processed successfully.`,
        'payment',
        'fas fa-check-circle text-green-500',
        '/dashboard/user/bookings'
      );
    }
    
    // Fetch user for email
    const { data: user } = await adminSupabase.from('users').select('email, name').eq('id', refund.user_id).single();
    if (user && user.email) {
       sendRefundEmail(user.email, user.name, refund.amount, refund.bookings.custom_id, refund.bookings.service_name).catch(e => console.error(e));
    }

    return res.status(200).json(updatedRefund);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/refunds/:id/reject (Admin only)
export const rejectRefund = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: refund, error: fetchError } = await adminSupabase
      .from('refunds')
      .select('*, bookings(custom_id)')
      .eq('id', id)
      .single();

    if (fetchError || !refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status !== 'pending') return res.status(400).json({ error: `Refund is already ${refund.status}` });

    const { data: updatedRefund, error: updateError } = await adminSupabase
      .from('refunds')
      .update({
        status: 'rejected',
        reason: reason || 'Rejected by Admin'
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Notify User
    if (refund.user_id) {
      createNotification(
        refund.user_id,
        'Refund Rejected',
        `Your refund request for ₹${refund.amount} has been rejected. Reason: ${reason || 'Admin decision'}`,
        'payment',
        'fas fa-times-circle text-red-500',
        '/dashboard/user/bookings'
      );
    }

    return res.status(200).json(updatedRefund);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
