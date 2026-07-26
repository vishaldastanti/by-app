import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    service_type: z.enum(['package', 'homestay', 'transport', 'guide']),
    service_id: z.string().min(1, 'Service ID is required'),
    service_name: z.string().min(1, 'Service name is required'),
    check_in: z.string().optional(), // Expected format YYYY-MM-DD
    check_out: z.string().optional(),
    guests: z.number().int().positive(),
    adults: z.number().int().nonnegative().optional(),
    children: z.number().int().nonnegative().optional(),
    bed_type: z.string().optional(),
    room_type: z.string().optional(),
    rooms: z.number().int().positive().optional(),
    notes: z.string().optional(),
    payment_method: z.string().optional(), // 'online' or 'location'
  })
});

export const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.string().transform(v => v.toLowerCase().trim()).pipe(z.enum(['pending', 'confirmed', 'in_progress', 'checked_in', 'cancelled', 'completed'])),
  })
});
