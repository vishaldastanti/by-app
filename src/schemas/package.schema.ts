import { z } from 'zod';

export const createPackageSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    slug: z.string().min(1, 'Slug is required'),
    duration_days: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0 && Number.isInteger(Number(val)),
      { message: "duration_days must be a positive integer" }
    ).transform(Number),
    duration_nights: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0 && Number.isInteger(Number(val)),
      { message: "duration_nights must be a non-negative integer" }
    ).transform(Number),
    price_per_person: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      { message: "price_per_person must be a positive number or zero" }
    ).transform(Number),
    cover_image_url: z.string().trim().optional().refine(val => !val || val === '' || /^https?:\/\//.test(val), { message: "Invalid URL" }).or(z.literal('')),
    destination_ids: z.array(z.string().uuid()).optional(),
    itinerary: z.array(z.object({
      day: z.union([z.string(), z.number()]).refine(
        (val) => !isNaN(Number(val)) && Number.isInteger(Number(val)),
        { message: "day must be a valid integer" }
      ).transform(Number),
      title: z.string(),
      description: z.string(),
      meals: z.union([z.string(), z.array(z.string())]).optional()
    })),
    includes: z.array(z.string()).optional(),
    excludes: z.array(z.string()).optional(),
    max_group_size: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0 && Number.isInteger(Number(val)),
      { message: "max_group_size must be a positive integer" }
    ).transform(Number).optional(),
    difficulty: z.enum(['easy', 'moderate', 'challenging']).optional(),
    is_published: z.boolean().default(false),
    provider: z.string().optional(),
    category: z.string().optional(),
    route: z.string().optional(),
    description: z.string().optional(),
    rating: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)),
      { message: "rating must be a valid number" }
    ).transform(Number).optional(),
    stay_details: z.string().optional(),
    transport_details: z.string().optional(),
    meal_details: z.string().optional(),
    pickup_address: z.string().optional(),
    boarding_point: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    places_covered: z.string().optional(),
    booking_type: z.enum(['booking', 'enquiry']).optional().default('enquiry')
  })
});

export const updatePackageSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    slug: z.string().optional(),
    duration_days: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0 && Number.isInteger(Number(val)),
      { message: "duration_days must be a positive integer" }
    ).transform(Number).optional(),
    duration_nights: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0 && Number.isInteger(Number(val)),
      { message: "duration_nights must be a non-negative integer" }
    ).transform(Number).optional(),
    price_per_person: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      { message: "price_per_person must be a positive number or zero" }
    ).transform(Number).optional(),
    cover_image_url: z.string().trim().optional().refine(val => !val || val === '' || /^https?:\/\//.test(val), { message: "Invalid URL" }).or(z.literal('')),
    destination_ids: z.array(z.string().uuid()).optional(),
    itinerary: z.array(z.object({
      day: z.union([z.string(), z.number()]).refine(
        (val) => !isNaN(Number(val)) && Number.isInteger(Number(val)),
        { message: "day must be a valid integer" }
      ).transform(Number),
      title: z.string().optional(),
      description: z.string().optional(),
      meals: z.union([z.string(), z.array(z.string())]).optional()
    })).optional(),
    includes: z.array(z.string()).optional(),
    excludes: z.array(z.string()).optional(),
    max_group_size: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0 && Number.isInteger(Number(val)),
      { message: "max_group_size must be a positive integer" }
    ).transform(Number).optional(),
    difficulty: z.enum(['easy', 'moderate', 'challenging']).optional(),
    provider: z.string().optional(),
    is_published: z.boolean().optional(),
    category: z.string().optional(),
    route: z.string().optional(),
    description: z.string().optional(),
    rating: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)),
      { message: "rating must be a valid number" }
    ).transform(Number).optional(),
    stay_details: z.string().optional(),
    transport_details: z.string().optional(),
    meal_details: z.string().optional(),
    pickup_address: z.string().optional(),
    boarding_point: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    places_covered: z.string().optional(),
    booking_type: z.enum(['booking', 'enquiry']).optional()
  })
});
