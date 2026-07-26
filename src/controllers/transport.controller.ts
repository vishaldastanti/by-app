import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { sendListingCreationEmail } from '../services/email.service';
import { generateCustomId } from '../utils/id.util';

// GET /api/v1/transports
export const getTransports = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { data, error } = await supabase
      .from('transports')
      .select('id, custom_id, vehicle_type, model, location, price_per_km, price_per_day, capacity, ac_available, images, avg_rating, review_count, is_verified')
      .eq('is_available', true);

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/transports/:id
export const getTransportById = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('transports')
      .select('*, users!provider_id(id, name, avatar_url, phone)')
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ error: 'Transport not found' });
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/transports (Providers/Admins)
export const createTransport = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // ── HIGH-1 FIX: Whitelist allowed fields to prevent mass assignment ──
    const { vehicle_type, model, location, price_per_km, price_per_day, capacity, ac_available, images, route_from, route_to, is_available } = req.body;
    const transportData: Record<string, any> = { custom_id: generateCustomId('BY-TRN'), provider_id: userId };
    if (vehicle_type !== undefined) transportData.vehicle_type = vehicle_type;
    if (model !== undefined) transportData.model = model;
    if (location !== undefined) transportData.location = location;
    if (price_per_km !== undefined) transportData.price_per_km = price_per_km;
    if (price_per_day !== undefined) transportData.price_per_day = price_per_day;
    if (capacity !== undefined) transportData.capacity = capacity;
    if (ac_available !== undefined) transportData.ac_available = ac_available;
    if (images !== undefined) transportData.images = images;
    if (route_from !== undefined) transportData.route_from = route_from;
    if (route_to !== undefined) transportData.route_to = route_to;
    if (is_available !== undefined) transportData.is_available = is_available;

    const { data, error } = await supabase
      .from('transports')
      .insert([transportData])
      .select()
      .single();

    if (error) throw error;

    if (req.user?.email) {
      sendListingCreationEmail(req.user.email, 'Partner', data.model || 'Your Transport Listing', 'Transport')
        .catch(e => console.error('Failed to send listing creation email:', e));
    }

    return res.status(201).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/v1/transports/:id
export const updateTransport = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    const { data: currentTransport, error: fetchError } = await supabase
      .from('transports')
      .select('provider_id')
      .eq('id', id)
      .single();

    if (fetchError || !currentTransport) return res.status(404).json({ error: 'Transport not found' });

    if (currentTransport.provider_id !== userId && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── CRIT-2 FIX: Whitelist allowed fields to prevent mass assignment ──
    const { vehicle_type, model, location, price_per_km, price_per_day, capacity, ac_available, images, is_available } = req.body;
    const allowedUpdate: Record<string, any> = {};
    if (vehicle_type !== undefined) allowedUpdate.vehicle_type = vehicle_type;
    if (model !== undefined) allowedUpdate.model = model;
    if (location !== undefined) allowedUpdate.location = location;
    if (price_per_km !== undefined) allowedUpdate.price_per_km = price_per_km;
    if (price_per_day !== undefined) allowedUpdate.price_per_day = price_per_day;
    if (capacity !== undefined) allowedUpdate.capacity = capacity;
    if (ac_available !== undefined) allowedUpdate.ac_available = ac_available;
    if (images !== undefined) allowedUpdate.images = images;
    if (is_available !== undefined) allowedUpdate.is_available = is_available;

    const { data, error } = await supabase
      .from('transports')
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

// DELETE /api/v1/transports/:id
export const deleteTransport = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;

    const { data: currentTransport } = await supabase
      .from('transports')
      .select('provider_id')
      .eq('id', id)
      .single();

    if (!currentTransport) return res.status(404).json({ error: 'Transport not found' });

    if (currentTransport.provider_id !== userId && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { error } = await supabase
      .from('transports')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/v1/transports/my/listings (Provider's own fleet)
export const getMyTransports = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    const { data, error } = await supabase
      .from('transports')
      .select('*')
      .eq('provider_id', userId);

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
