import { z } from 'zod';

export const createGuideSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required'),
    bio: z.string().optional(),
    location: z.string().min(1, 'Location is required'),
    languages: z.array(z.string()),
    skills: z.array(z.string()).optional(),
    price_per_day: z.number().positive(),
    profile_image_url: z.string().url().optional(),
    is_available: z.boolean().default(true),
    is_verified: z.boolean().default(false),
  })
});

export const updateGuideSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    languages: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    price_per_day: z.number().positive().optional(),
    profile_image_url: z.string().url().optional(),
    is_available: z.boolean().optional(),
    is_verified: z.boolean().optional(),
  })
});
