import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

// Get public reviews for a service
export const getServiceReviews = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const { serviceType, serviceId } = req.params;
        const allowedTypes = new Set(['package', 'homestay', 'transport', 'guide']);

        if (typeof serviceType !== 'string' || typeof serviceId !== 'string') {
            return res.status(400).json({ error: 'Invalid review request' });
        }

        if (!allowedTypes.has(serviceType)) {
            return res.status(400).json({ error: 'Invalid service type' });
        }

        const { data, error } = await supabase
            .from('reviews')
            .select('id, custom_id, user_id, rating, comment, is_verified, created_at, provider_response, provider_responded_at')
            .eq('service_type', serviceType)
            .eq('service_id', serviceId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch reviews' });
        }

        const userIds = [...new Set((data || []).map(review => review.user_id).filter(Boolean))];
        let userMap = new Map();

        if (userIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, custom_id, name, avatar_url')
                .in('id', userIds);

            userMap = new Map((users || []).map(user => [user.id, user]));
        }

        const reviews = (data || []).map(review => {
            const user = userMap.get(review.user_id);

            return {
                ...review,
                user_name: user?.name || 'Guest',
                user_avatar_url: user?.avatar_url || null,
                user_id: undefined,
            };
        });

        return res.json(reviews);
    } catch (error) {
        console.error('Service reviews fetch error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Get pending reviews for the user
export const getPendingReviews = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch completed bookings that do NOT have a review
        // Supabase/PostgreSQL doesn't have an easy NOT IN with linked tables in standard JS client easily,
        // so we'll fetch completed bookings, and then fetch existing user reviews, and filter in memory (or write a view/RPC).
        // Since this is MVP, in-memory filtering is fine for typical user load.

        const { data: completedBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('check_out', { ascending: false });

        if (bookingsError) {
            return res.status(500).json({ error: 'Failed to fetch bookings' });
        }

        if (!completedBookings || completedBookings.length === 0) {
            return res.json([]);
        }

        const { data: userReviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('booking_id')
            .eq('user_id', userId);

        if (reviewsError) {
            return res.status(500).json({ error: 'Failed to fetch existing reviews' });
        }

        const reviewedBookingIds = new Set((userReviews || []).map(r => r.booking_id));
        
        const pendingReviews = completedBookings.filter(b => !reviewedBookingIds.has(b.id));

        return res.json(pendingReviews);
    } catch (error) {
        console.error('Pending reviews fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get past reviews for the user
export const getPastReviews = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data, error } = await supabase
            .from('reviews')
            .select('*, bookings(service_name, check_in)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Failed to fetch past reviews' });
        return res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Submit a new review
export const submitReview = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { booking_id, rating, comment } = req.body;

        if (!booking_id || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Valid booking ID and rating (1-5) are required' });
        }

        // Verify the booking belongs to the user and is completed
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', booking_id)
            .eq('user_id', userId)
            .single();

        if (bookingError || !booking) {
            return res.status(403).json({ error: 'Invalid booking or unauthorized' });
        }

        if (booking.status !== 'completed') {
            return res.status(400).json({ error: 'Can only review completed trips' });
        }

        const payload = {
            booking_id,
            user_id: userId,
            service_id: booking.service_id,
            service_type: booking.service_type,
            rating: parseInt(rating as unknown as string),
            comment,
            is_verified: true
        };

        const { data, error } = await supabase
            .from('reviews')
            .insert([payload])
            .select()
            .single();

        if (error) {
            // Check for unique constraint violation (already reviewed)
            if (error.code === '23505') {
                return res.status(400).json({ error: 'You have already reviewed this booking' });
            }
            console.error('Error submitting review:', error);
            return res.status(500).json({ error: 'Failed to submit review' });
        }

        return res.status(201).json(data);
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /api/v1/reviews/provider (Reviews for the provider's own services)
export const getProviderReviews = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;

    // Collect all service IDs owned by this provider across all service types
    const serviceIds: string[] = [];

    const [homestays, transports, guides] = await Promise.all([
      supabase.from('homestays').select('id').eq('host_id', userId),
      supabase.from('transports').select('id').eq('provider_id', userId),
      supabase.from('guides').select('id').eq('user_id', userId),
    ]);

    if (homestays.data) serviceIds.push(...homestays.data.map((h: any) => h.id));
    if (transports.data) serviceIds.push(...transports.data.map((t: any) => t.id));
    if (guides.data) serviceIds.push(...guides.data.map((g: any) => g.id));

    if (serviceIds.length === 0) {
      return res.status(200).json([]);
    }

    const { data, error } = await adminSupabase
      .from('reviews')
      .select('*, bookings(service_name, check_in, custom_id)')
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with guest contact info
    const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
    let userMap = new Map();
    if (userIds.length > 0) {
      const { data: users } = await adminSupabase
        .from('users')
        .select('id, custom_id, name')
        .in('id', userIds);
      userMap = new Map((users || []).map(u => [u.id, u]));
    }

    const enriched = (data || []).map(review => {
      const guest = userMap.get(review.user_id);
      return {
        ...review,
        user_name: guest?.name || 'Guest',
      };
    });

    return res.status(200).json(enriched);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/v1/reviews/:id/respond (Provider responds to a review)
export const respondToReview = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const userId = req.user?.user_id;
    const { id } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Response text is required' });
    }

    // Verify the review exists and belongs to a service owned by the provider
    const { data: review, error: fetchError } = await supabase
      .from('reviews')
      .select('service_id, service_type')
      .eq('id', id)
      .single();

    if (fetchError || !review) return res.status(404).json({ error: 'Review not found' });

    let ownsService = false;
    if (review.service_type === 'homestay') {
      const { data } = await supabase.from('homestays').select('id').eq('id', review.service_id).eq('host_id', userId).single();
      if (data) ownsService = true;
    } else if (review.service_type === 'transport') {
      const { data } = await supabase.from('transports').select('id').eq('id', review.service_id).eq('provider_id', userId).single();
      if (data) ownsService = true;
    } else if (review.service_type === 'guide') {
      const { data } = await supabase.from('guides').select('id').eq('id', review.service_id).eq('user_id', userId).single();
      if (data) ownsService = true;
    }

    if (!ownsService) {
      return res.status(403).json({ error: 'Forbidden: You do not own this service' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({
        provider_response: response.trim(),
        provider_responded_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
