import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';
import { parsePagination } from '../utils/pagination.util';

export const getPendingProviders = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await supabase
      .from('users')
      .select('id, custom_id, name, email, phone, role, provider_type, provider_status, legal_documents, created_at, updated_at')
      .eq('role', 'provider')
      .in('provider_status', ['pending_verification', 'verified', 'rejected'])
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('Error fetching pending providers:', error);
      return res.status(500).json({ error: 'Failed to fetch pending providers' });
    }

    return res.status(200).json(data || []);
  } catch (error: any) {
    console.error('getPendingProviders error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFinancialStats = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, custom_id, total_amount, status, payment_status, payout_status, created_at, service_type, service_name');

    if (error) {
      console.error('Error fetching financial stats:', error);
      return res.status(500).json({ error: 'Failed to fetch financial stats' });
    }

    const gmv = (bookings || [])
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

    // Platform revenue (0% commission)
    const platformRevenue = gmv * 0;
    
    // Pending payouts (85% of confirmed OR completed but NOT paid out)
    const pendingPayouts = (bookings || [])
      .filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.payout_status !== 'paid_out')
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0) * 1;

    // Completed payouts (85% of completed AND paid out)
    const completedPayouts = (bookings || [])
      .filter(b => b.status === 'completed' && b.payout_status === 'paid_out')
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0) * 1;

    return res.status(200).json({
      gmv,
      platformRevenue,
      pendingPayouts,
      completedPayouts,
      bookings: bookings || []
    });
  } catch (error: any) {
    console.error('getFinancialStats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllBookings = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching bookings:', error);
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }

    const userIds = [...new Set((data || []).map(b => b.user_id).filter(Boolean))];
    let userMap = new Map();

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .in('id', userIds);
      userMap = new Map((users || []).map(u => [u.id, u]));
    }

    const enrichedBookings = (data || []).map(b => {
      let derivedStatus = b.status;
      if (b.status === 'confirmed' && b.checked_in_at && !b.checked_out_at) {
        derivedStatus = 'checked_in';
      }
      return {
        ...b,
        status: derivedStatus,
        users: userMap.get(b.user_id) || null
      };
    });

    return res.status(200).json(enrichedBookings);
  } catch (error: any) {
    console.error('getAllBookings error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminBookingById = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching booking details:', error);
      return res.status(500).json({ error: 'Failed to fetch booking details' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Fetch related user
    let userDetails = null;
    if (data.user_id) {
      const { data: user } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .eq('id', data.user_id)
        .single();
      userDetails = user;
    }

    // Fetch related service details based on service_type
    let serviceDetails = null;
    if (data.service_id) {
      let tableName = '';
      let selectFields = '';

      if (data.service_type === 'homestay') {
        tableName = 'homestays';
        selectFields = 'id, name, location, cover_image_url';
      } else if (data.service_type === 'transport') {
        tableName = 'transports';
        selectFields = 'id, vehicle_type, model, location';
      } else if (data.service_type === 'guide') {
        tableName = 'guides';
        selectFields = 'id, name, location, profile_image_url';
      } else if (data.service_type === 'package') {
        tableName = 'packages';
        selectFields = 'id, title as name, cover_image_url';
      }

      if (tableName) {
        const { data: service } = await supabase
          .from(tableName)
          .select(selectFields)
          .eq('id', data.service_id)
          .single();
        
        serviceDetails = service;
      }
    }

    let derivedStatus = data.status;
    if (data.status === 'confirmed' && data.checked_in_at && !data.checked_out_at) {
      derivedStatus = 'checked_in';
    }

    const enrichedData = {
      ...data,
      status: derivedStatus,
      users: userDetails,
      homestays: data.service_type === 'homestay' ? serviceDetails : null,
      transports: data.service_type === 'transport' ? serviceDetails : null,
      guides: data.service_type === 'guide' ? serviceDetails : null,
      packages: data.service_type === 'package' ? serviceDetails : null,
    };

    return res.status(200).json(enrichedData);
  } catch (error: any) {
    console.error('getAdminBookingById error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllPackages = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await supabase
      .from('packages')
      .select('id, custom_id, title, slug, is_published, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching packages:', error);
      return res.status(500).json({ error: 'Failed to fetch packages' });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('getAllPackages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllHomestays = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await supabase
      .from('homestays')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching homestays:', error);
      return res.status(500).json({ error: 'Failed to fetch homestays' });
    }

    const homestays = (data || []).map(homestay => ({
      ...homestay,
      status: !homestay.is_published ? 'draft' : homestay.is_available ? 'active' : 'paused',
    }));

    return res.status(200).json(homestays);
  } catch (error: any) {
    console.error('getAllHomestays error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateListingStatus = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    const { type, id } = req.params;
    const { status } = req.body;
    
    let table = '';
    if (type === 'homestay') table = 'homestays';
    else if (type === 'package') table = 'packages';
    else if (type === 'transport') table = 'transports';
    else if (type === 'guide') table = 'guides';
    else return res.status(400).json({ error: 'Invalid listing type' });

    // Assuming we map 'suspended' to a field. 
    // In our DB schema, we have `is_published` and `is_available`. Let's use `is_published = false` as "suspended".
    // Or if there's a status field, we update that. Let's assume we update `is_published` for now.
    let updatePayload: any = { is_published: status !== 'suspended' };
    if (table === 'homestays' || table === 'transports' || table === 'guides') {
      updatePayload.is_available = status !== 'suspended';
    }

    const { data, error } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating listing status:', error);
      return res.status(500).json({ error: 'Failed to update listing status' });
    }

    return res.status(200).json(data || []);
  } catch (error: any) {
    console.error('updateListingStatus error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting review:', error);
      return res.status(500).json({ error: 'Failed to delete review' });
    }

    return res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error: any) {
    console.error('deleteReview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllReviews = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    // ── SEC-05 FIX: Paginate to prevent unbounded queries ──
    const { from, to } = parsePagination(req.query, 200);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching reviews:', error);
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }

    const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
    let userMap = new Map();

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, custom_id, name')
        .in('id', userIds);
      userMap = new Map((users || []).map(u => [u.id, u]));
    }

    const enrichedReviews = await Promise.all((data || []).map(async (review) => {
      const user = userMap.get(review.user_id);
      
      let serviceName = null;
      if (review.service_id && review.service_type) {
        let tableName = '';
        let nameField = 'name';
        if (review.service_type === 'homestay') tableName = 'homestays';
        else if (review.service_type === 'transport') tableName = 'transports';
        else if (review.service_type === 'guide') tableName = 'guides';
        else if (review.service_type === 'package') { tableName = 'packages'; nameField = 'title as name'; }
        else if (review.service_type === 'destination') { tableName = 'destinations'; nameField = 'name'; }
        
        if (tableName) {
          const { data: service } = await supabase
            .from(tableName)
            .select(nameField)
            .eq('id', review.service_id)
            .single();
          if (service && (service as any).name) {
            serviceName = (service as any).name;
          }
        }
      }

      return {
        ...review,
        users: user ? { id: user.id, name: user.name } : null,
        service_name: serviceName
      };
    }));

    return res.status(200).json(enrichedReviews);
  } catch (error: any) {
    console.error('getAllReviews error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const markPayoutsPaid = async (req: Request, res: Response) => {
  const supabase = adminSupabase;
  try {
    const { provider_id } = req.body;
    
    if (!provider_id) {
      return res.status(400).json({ error: 'provider_id is required' });
    }

    // Collect all service IDs owned by this provider
    const [homestays, transports, guides] = await Promise.all([
      supabase.from('homestays').select('id').eq('host_id', provider_id),
      supabase.from('transports').select('id').eq('provider_id', provider_id),
      supabase.from('guides').select('id').eq('user_id', provider_id),
    ]);

    const serviceIds: string[] = [];
    if (homestays.data) serviceIds.push(...homestays.data.map((h: any) => h.id));
    if (transports.data) serviceIds.push(...transports.data.map((t: any) => t.id));
    if (guides.data) serviceIds.push(...guides.data.map((g: any) => g.id));

    if (serviceIds.length === 0) {
      return res.status(404).json({ error: 'No services found for this provider' });
    }

    // Update completed bookings that are not paid out yet
    const { data, error } = await supabase
      .from('bookings')
      .update({ payout_status: 'paid_out', payout_date: new Date().toISOString() })
      .in('service_id', serviceIds)
      .eq('status', 'completed')
      .or('payout_status.eq.pending,payout_status.is.null')
      .select();

    if (error) {
      console.error('Error marking payouts paid:', error);
      return res.status(500).json({ error: 'Failed to mark payouts as paid' });
    }

    return res.status(200).json({ message: 'Successfully marked payouts as paid', updatedBookings: data || [] });
  } catch (error: any) {
    console.error('markPayoutsPaid error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
