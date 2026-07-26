import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    currency: z.string().default('INR'),
    booking_id: z.string().uuid('Booking ID is required'),
    receipt: z.string().optional(),
    payment_type: z.enum(['full', 'advance']).optional().default('full'),
  })
});

// Note: webhook validation isn't strictly Zod because we must verify the HMAC signature from Razorpay directly.
