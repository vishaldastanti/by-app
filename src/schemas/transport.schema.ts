import { z } from 'zod';

export const createTransportSchema = z.object({
  body: z.object({
    vehicle_type: z.string().min(1, 'Vehicle type required'),
    model: z.string().min(1, 'Model required'),
    location: z.string().min(1, 'Location required'),
    price_per_km: z.number().positive(),
    price_per_day: z.number().positive(),
    capacity: z.number().int().positive(),
    ac_available: z.boolean().default(true),
    driver_name: z.string().optional(),
    vehicle_registration: z.string().optional(),
    images: z.array(z.string().url()).optional(),
    is_available: z.boolean().default(true),
    is_verified: z.boolean().default(false),
  })
});

export const updateTransportSchema = z.object({
  body: z.object({
    vehicle_type: z.string().optional(),
    model: z.string().optional(),
    location: z.string().optional(),
    price_per_km: z.number().positive().optional(),
    price_per_day: z.number().positive().optional(),
    capacity: z.number().int().positive().optional(),
    ac_available: z.boolean().optional(),
    driver_name: z.string().optional(),
    vehicle_registration: z.string().optional(),
    images: z.array(z.string().url()).optional(),
    is_available: z.boolean().optional(),
    is_verified: z.boolean().optional(),
  })
});
