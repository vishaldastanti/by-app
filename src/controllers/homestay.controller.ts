import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { sendListingCreationEmail } from '../services/email.service';
import { generateCustomId } from '../utils/id.util';

// GET /api/v1/homestays
export const getHomestays = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { data, error } = await supabase
      .from('homestays')
      .select('id, custom_id, name, slug, location, price_per_night, max_guests, amenities, images, cover_image_url, badge, avg_rating, review_count, created_at')
      .eq('is_published', true)
      .eq('is_available', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/homestays/:slug
export const getHomestayBySlug = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { slug } = req.params;
    const { data, error } = await supabase
      .from('homestays')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) {
      console.error('getHomestayBySlug error:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Homestay not found' });
    }

    let responseData = { ...data };
    if (data && data.host_id) {
      const { data: hostData } = await adminSupabase
        .from('users')
        .select('name, avatar_url, phone')
        .eq('id', data.host_id)
        .maybeSingle();
      if (hostData) {
        responseData.host = hostData;
      }
    }
    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error('getHomestayBySlug catch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/homestays (Providers and Admins)
export const createHomestay = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const hostId = req.user?.user_id; // JWT user ID
    if (!hostId) return res.status(401).json({ error: 'Unauthorized' });

    // ── HIGH-1 FIX: Whitelist allowed fields to prevent mass assignment ──
    const { name, slug, description, location, address, exact_location, map_location_url, lat, lng, price_per_night, weekend_price, max_guests, max_adults, max_children, number_of_rooms, room_type, bed_type, ac_type, rules_and_policies, checkin_time, checkout_time, amenities, images, cover_image_url, room_images, is_available, is_published } = req.body;
    const homestayData: Record<string, any> = { custom_id: generateCustomId('BY-HMS'), host_id: hostId };
    if (name !== undefined) homestayData.name = name;
    if (slug !== undefined) homestayData.slug = slug;
    if (description !== undefined) homestayData.description = description;
    if (location !== undefined) homestayData.location = location;
    if (address !== undefined) homestayData.address = address;
    if (exact_location !== undefined) homestayData.exact_location = exact_location;
    if (map_location_url !== undefined) homestayData.map_location_url = map_location_url;
    if (lat !== undefined) homestayData.lat = lat;
    if (lng !== undefined) homestayData.lng = lng;
    if (price_per_night !== undefined) homestayData.price_per_night = price_per_night;
    if (weekend_price !== undefined) homestayData.weekend_price = weekend_price;
    if (max_guests !== undefined) homestayData.max_guests = max_guests;
    if (max_adults !== undefined) homestayData.max_adults = max_adults;
    if (max_children !== undefined) homestayData.max_children = max_children;
    if (number_of_rooms !== undefined) homestayData.number_of_rooms = number_of_rooms;
    if (room_type !== undefined) homestayData.room_type = room_type;
    if (bed_type !== undefined) homestayData.bed_type = bed_type;
    if (ac_type !== undefined) homestayData.ac_type = ac_type;
    if (rules_and_policies !== undefined) homestayData.rules_and_policies = rules_and_policies;
    if (checkin_time !== undefined) homestayData.checkin_time = checkin_time === '' ? null : checkin_time;
    if (checkout_time !== undefined) homestayData.checkout_time = checkout_time === '' ? null : checkout_time;
    if (amenities !== undefined) homestayData.amenities = amenities;
    if (images !== undefined) homestayData.images = images;
    if (cover_image_url !== undefined) homestayData.cover_image_url = cover_image_url;
    if (room_images !== undefined) homestayData.room_images = room_images;
    if (is_available !== undefined) homestayData.is_available = is_available;
    // Auto-publish by default for approved providers
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'content_manager' || req.user?.role === 'approval_manager';
    homestayData.is_published = isAdmin ? (is_published ?? true) : false;

    const { data, error } = await supabase
      .from('homestays')
      .insert([homestayData])
      .select()
      .single();

    if (error) throw error;

    if (req.user?.email) {
      sendListingCreationEmail(req.user.email, 'Partner', data.name || 'Your Listing', 'Homestay')
        .catch(e => console.error('Failed to send listing creation email:', e));
    }

    return res.status(201).json(data);
  } catch (error: any) {
    console.error('createHomestay error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/v1/homestays/:id
export const updateHomestay = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'content_manager' || req.user?.role === 'approval_manager';

    // Must be host or admin
    const { data: currentHomestay, error: fetchError } = await supabase
      .from('homestays')
      .select('host_id')
      .eq('id', id)
      .single();

    if (fetchError || !currentHomestay) {
      return res.status(404).json({ error: 'Homestay not found' });
    }

    if (currentHomestay.host_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── CRIT-2 FIX: Whitelist allowed fields to prevent mass assignment ──
    const { name, slug, description, location, address, exact_location, map_location_url, lat, lng, price_per_night, weekend_price, max_guests, max_adults, max_children, number_of_rooms, room_type, bed_type, ac_type, rules_and_policies, checkin_time, checkout_time, amenities, images, cover_image_url, room_images, badge, avg_rating, review_count, is_available, is_published } = req.body;
    const allowedUpdate: Record<string, any> = {};
    if (name !== undefined) allowedUpdate.name = name;
    if (slug !== undefined) allowedUpdate.slug = slug;
    if (description !== undefined) allowedUpdate.description = description;
    if (location !== undefined) allowedUpdate.location = location;
    if (address !== undefined) allowedUpdate.address = address;
    if (exact_location !== undefined) allowedUpdate.exact_location = exact_location;
    if (map_location_url !== undefined) allowedUpdate.map_location_url = map_location_url;
    if (lat !== undefined) allowedUpdate.lat = lat;
    if (lng !== undefined) allowedUpdate.lng = lng;
    if (price_per_night !== undefined) allowedUpdate.price_per_night = price_per_night;
    if (weekend_price !== undefined) allowedUpdate.weekend_price = weekend_price;
    if (max_guests !== undefined) allowedUpdate.max_guests = max_guests;
    if (max_adults !== undefined) allowedUpdate.max_adults = max_adults;
    if (max_children !== undefined) allowedUpdate.max_children = max_children;
    if (number_of_rooms !== undefined) allowedUpdate.number_of_rooms = number_of_rooms;
    if (room_type !== undefined) allowedUpdate.room_type = room_type;
    if (bed_type !== undefined) allowedUpdate.bed_type = bed_type;
    if (ac_type !== undefined) allowedUpdate.ac_type = ac_type;
    if (rules_and_policies !== undefined) allowedUpdate.rules_and_policies = rules_and_policies;
    if (checkin_time !== undefined) allowedUpdate.checkin_time = checkin_time === '' ? null : checkin_time;
    if (checkout_time !== undefined) allowedUpdate.checkout_time = checkout_time === '' ? null : checkout_time;
    if (amenities !== undefined) allowedUpdate.amenities = amenities;
    if (images !== undefined) allowedUpdate.images = images;
    if (cover_image_url !== undefined) allowedUpdate.cover_image_url = cover_image_url;
    if (room_images !== undefined) allowedUpdate.room_images = room_images;
    if (badge !== undefined && isAdmin) allowedUpdate.badge = badge;
    if (avg_rating !== undefined && isAdmin) allowedUpdate.avg_rating = avg_rating;
    if (review_count !== undefined && isAdmin) allowedUpdate.review_count = review_count;
    if (is_available !== undefined) allowedUpdate.is_available = is_available;
    if (is_published !== undefined && isAdmin) allowedUpdate.is_published = is_published;

    const { data, error } = await supabase
      .from('homestays')
      .update(allowedUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/v1/homestays/:id
export const deleteHomestay = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    const { data: currentHomestay, error: fetchError } = await supabase
      .from('homestays')
      .select('host_id')
      .eq('id', id)
      .single();

    if (fetchError || !currentHomestay) {
      return res.status(404).json({ error: 'Homestay not found' });
    }

    if (currentHomestay.host_id !== userId && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { error } = await supabase
      .from('homestays')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/v1/homestays/:id/availability
export const toggleAvailability = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const { is_available } = req.body;
    const userId = req.user?.user_id;

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ error: 'is_available boolean is required' });
    }

    const { data: currentHomestay } = await supabase
      .from('homestays')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!currentHomestay) return res.status(404).json({ error: 'Homestay not found' });
    
    if (currentHomestay.host_id !== userId && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from('homestays')
      .update({ is_available })
      .eq('id', id)
      .select('id, custom_id, is_available')
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/homestays/my (Provider listings)
export const getMyHomestays = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    const { data, error } = await supabase
      .from('homestays')
      .select('*')
      .eq('host_id', userId);

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
