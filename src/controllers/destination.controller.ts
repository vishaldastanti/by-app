import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

// GET /api/v1/destinations
export const getDestinations = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('id, name, slug, tagline, description, price, rating, review_count, category, location, hero_image_url, is_published, sections, highlights')
      .eq('is_published', true);

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/destinations/:slug
export const getDestinationBySlug = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { slug } = req.params;
    const { data, error } = await supabase
      .from('destinations')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error) return res.status(404).json({ error: 'Destination not found' });
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/destinations (Admin only)
export const createDestination = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    // ── HIGH-1 FIX: Whitelist allowed fields to prevent mass assignment ──
    const { name, slug, tagline, description, price, category, location, hero_image_url, sections, highlights, best_time, lat, lng, tags, is_published } = req.body;
    const destinationData: Record<string, any> = { created_by: userId };
    if (name !== undefined) destinationData.name = name;
    if (slug !== undefined) destinationData.slug = slug;
    if (tagline !== undefined) destinationData.tagline = tagline;
    if (description !== undefined) destinationData.description = description;
    if (price !== undefined) destinationData.price = price;
    if (category !== undefined) destinationData.category = category;
    if (location !== undefined) destinationData.location = location;
    if (hero_image_url !== undefined) destinationData.hero_image_url = hero_image_url;
    if (sections !== undefined) destinationData.sections = sections;
    if (highlights !== undefined) destinationData.highlights = highlights;
    if (best_time !== undefined) destinationData.best_time = best_time;
    if (lat !== undefined) destinationData.lat = lat;
    if (lng !== undefined) destinationData.lng = lng;
    if (tags !== undefined) destinationData.tags = tags;
    if (is_published !== undefined) destinationData.is_published = is_published;

    const { data, error } = await supabase
      .from('destinations')
      .insert([destinationData])
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/v1/destinations/:id (Admin only)
export const updateDestination = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    // ── CRIT-2 FIX: Whitelist allowed fields to prevent mass assignment ──
    const { name, slug, tagline, description, price, rating, review_count, category, location, hero_image_url, sections, highlights, best_time, lat, lng, tags, is_published } = req.body;
    const allowedUpdate: Record<string, any> = {};
    if (name !== undefined) allowedUpdate.name = name;
    if (slug !== undefined) allowedUpdate.slug = slug;
    if (tagline !== undefined) allowedUpdate.tagline = tagline;
    if (description !== undefined) allowedUpdate.description = description;
    if (price !== undefined) allowedUpdate.price = price;
    if (rating !== undefined) allowedUpdate.rating = rating;
    if (review_count !== undefined) allowedUpdate.review_count = review_count;
    if (category !== undefined) allowedUpdate.category = category;
    if (location !== undefined) allowedUpdate.location = location;
    if (hero_image_url !== undefined) allowedUpdate.hero_image_url = hero_image_url;
    if (sections !== undefined) allowedUpdate.sections = sections;
    if (highlights !== undefined) allowedUpdate.highlights = highlights;
    if (best_time !== undefined) allowedUpdate.best_time = best_time;
    if (lat !== undefined) allowedUpdate.lat = lat;
    if (lng !== undefined) allowedUpdate.lng = lng;
    if (tags !== undefined) allowedUpdate.tags = tags;
    // Admins can toggle publish status
    if (is_published !== undefined) allowedUpdate.is_published = is_published;

    const { data, error } = await supabase
      .from('destinations')
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

// DELETE /api/v1/destinations/:id (Admin only)
export const deleteDestination = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('destinations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/destinations/search
export const searchDestinations = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    // ── MED-3 FIX: Escape SQL wildcard characters in user input ──
    const sanitizedQ = q.replace(/%/g, '\\%').replace(/_/g, '\\_');

    const { data, error } = await supabase
      .from('destinations')
      .select('*')
      .eq('is_published', true)
      .ilike('name', `%${sanitizedQ}%`);

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
