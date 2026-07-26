import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { sendListingCreationEmail } from '../services/email.service';
import { generateCustomId } from '../utils/id.util';

// GET /api/v1/packages/trending
export const getTrendingPackages = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    // 1. Fetch all published packages
    const { data: packages, error: packagesError } = await supabase
      .from('packages')
      .select('id, custom_id, title, slug, duration_days, duration_nights, price_per_person, cover_image_url, difficulty, is_published, provider, category, route, description, rating, stay_details, transport_details, meal_details, itinerary, includes, excludes, max_group_size, destination_ids, pickup_address, boarding_point, start_date, end_date, places_covered, booking_type')
      .eq('is_published', true);

    if (packagesError) throw packagesError;

    if (!packages || packages.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Fetch bookings for packages
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('service_id')
      .eq('service_type', 'package')
      .in('status', ['confirmed', 'completed', 'in_progress']);

    if (bookingsError) throw bookingsError;

    // 3. Calculate bookings per package
    const bookingCounts: Record<string, number> = {};
    if (bookings) {
      bookings.forEach((booking: any) => {
        bookingCounts[booking.service_id] = (bookingCounts[booking.service_id] || 0) + 1;
      });
    }

    // 4. Sort packages
    const sortedPackages = packages.sort((a: any, b: any) => {
      const aBookings = bookingCounts[a.id] || 0;
      const bBookings = bookingCounts[b.id] || 0;
      
      // Sort by bookings descending
      if (bBookings !== aBookings) {
        return bBookings - aBookings;
      }
      // Fallback to rating descending if bookings are equal
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      return bRating - aRating;
    });

    // 5. Return top 3
    const topPackages = sortedPackages.slice(0, 3);
    
    return res.status(200).json(topPackages);
  } catch (error: any) {
    console.error('Error fetching trending packages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/packages
export const getPackages = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { data, error } = await supabase
      .from('packages')
      .select('id, custom_id, title, slug, duration_days, duration_nights, price_per_person, cover_image_url, difficulty, is_published, provider, category, route, description, rating, stay_details, transport_details, meal_details, itinerary, includes, excludes, max_group_size, destination_ids, pickup_address, boarding_point, start_date, end_date, places_covered, booking_type')
      .eq('is_published', true);

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/packages/:slug
export const getPackageBySlug = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { slug } = req.params;
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error) return res.status(404).json({ error: 'Package not found' });
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/packages/id/:id
export const getPackageById = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (error) return res.status(404).json({ error: 'Package not found' });
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/packages (Admin only)
export const createPackage = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    const packageData = { ...req.body, custom_id: generateCustomId('BY-PKG'), created_by: userId };
    if (packageData.start_date === '') packageData.start_date = null;
    if (packageData.end_date === '') packageData.end_date = null;

    const { data, error } = await supabase
      .from('packages')
      .insert([packageData])
      .select()
      .single();

    if (error) throw error;

    if (req.user?.email) {
      sendListingCreationEmail(req.user.email, 'Partner', data.title || 'Your Package', 'Package')
        .catch(e => console.error('Failed to send listing creation email:', e));
    }

    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Error creating package:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/v1/packages/:id (Admin only)
export const updatePackage = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const { title, slug, duration_days, duration_nights, price_per_person, cover_image_url, destination_ids, itinerary, includes, excludes, max_group_size, difficulty, is_published, provider, category, route, description, rating, stay_details, transport_details, meal_details, pickup_address, boarding_point, start_date, end_date, places_covered, booking_type } = req.body;
    const allowedUpdate: Record<string, any> = {};
    if (title !== undefined) allowedUpdate.title = title;
    if (slug !== undefined) allowedUpdate.slug = slug;
    if (duration_days !== undefined) allowedUpdate.duration_days = duration_days;
    if (duration_nights !== undefined) allowedUpdate.duration_nights = duration_nights;
    if (price_per_person !== undefined) allowedUpdate.price_per_person = price_per_person;
    if (cover_image_url !== undefined) allowedUpdate.cover_image_url = cover_image_url;
    if (destination_ids !== undefined) allowedUpdate.destination_ids = destination_ids;
    if (itinerary !== undefined) allowedUpdate.itinerary = itinerary;
    if (includes !== undefined) allowedUpdate.includes = includes;
    if (excludes !== undefined) allowedUpdate.excludes = excludes;
    if (max_group_size !== undefined) allowedUpdate.max_group_size = max_group_size;
    if (difficulty !== undefined) allowedUpdate.difficulty = difficulty;
    if (is_published !== undefined) allowedUpdate.is_published = is_published;
    if (provider !== undefined) allowedUpdate.provider = provider;
    if (category !== undefined) allowedUpdate.category = category;
    if (route !== undefined) allowedUpdate.route = route;
    if (description !== undefined) allowedUpdate.description = description;
    if (rating !== undefined) allowedUpdate.rating = rating;
    if (stay_details !== undefined) allowedUpdate.stay_details = stay_details;
    if (transport_details !== undefined) allowedUpdate.transport_details = transport_details;
    if (meal_details !== undefined) allowedUpdate.meal_details = meal_details;
    if (pickup_address !== undefined) allowedUpdate.pickup_address = pickup_address;
    if (boarding_point !== undefined) allowedUpdate.boarding_point = boarding_point;
    if (start_date !== undefined) allowedUpdate.start_date = start_date === '' ? null : start_date;
    if (end_date !== undefined) allowedUpdate.end_date = end_date === '' ? null : end_date;
    if (places_covered !== undefined) allowedUpdate.places_covered = places_covered;
    if (booking_type !== undefined) allowedUpdate.booking_type = booking_type;

    const { data, error } = await supabase
      .from('packages')
      .update(allowedUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error updating package:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/v1/packages/:id (Admin only)
export const deletePackage = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
