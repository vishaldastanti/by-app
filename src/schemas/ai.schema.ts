import { z } from 'zod';

export const planTripSchema = z.object({
  body: z.object({
    destination: z.string().min(1, 'Destination is required'),
    days: z.number().int().positive('Days must be a positive integer'),
    budget: z.enum(['budget', 'moderate', 'luxury']),
    interests: z.array(z.string()).optional(),
  })
});
