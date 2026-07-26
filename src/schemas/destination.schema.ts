import { z } from 'zod';

export const createDestinationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required'),
    tagline: z.string().optional(),
    category: z.enum(['heritage', 'spiritual', 'nature', 'cultural']),
    location: z.string().min(1, 'Location is required'),
    hero_image_url: z.string().url().optional().or(z.literal('')),
    sections: z.array(z.object({
      header: z.string(),
      content: z.string(),
      image_url: z.string().optional()
    })).optional(),
    highlights: z.array(z.string()).optional(),
    best_time: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    tags: z.array(z.string()).optional(),
    is_published: z.boolean().default(false),
    description: z.string().optional(),
    price: z.string().optional(),
    rating: z.number().optional(),
    review_count: z.number().int().optional()
  })
});

export const updateDestinationSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    tagline: z.string().optional(),
    category: z.enum(['heritage', 'spiritual', 'nature', 'cultural']).optional(),
    location: z.string().optional(),
    hero_image_url: z.string().url().optional().or(z.literal('')),
    sections: z.array(z.object({
      header: z.string(),
      content: z.string(),
      image_url: z.string().optional()
    })).optional(),
    highlights: z.array(z.string()).optional(),
    best_time: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    tags: z.array(z.string()).optional(),
    is_published: z.boolean().optional(),
    description: z.string().optional(),
    price: z.string().optional(),
    rating: z.number().optional(),
    review_count: z.number().int().optional()
  })
});
