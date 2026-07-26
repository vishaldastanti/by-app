import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

// Get user notifications
export const getNotifications = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id || req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notifications:', error);
            return res.status(500).json({ error: 'Failed to fetch notifications' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Mark a specific notification as read
export const markAsRead = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id || req.user?.user_id;
        const notificationId = req.params.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }


        const { data, error } = await supabase
            .from('notifications')
            .update({ is_read: true, updated_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error marking notification as read:', error);
            return res.status(500).json({ error: 'Failed to mark notification as read' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Mark all notifications for a user as read
export const markAllAsRead = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
    try {
        const userId = req.user?.user_id || req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('notifications')
            .update({ is_read: true, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('is_read', false)
            .select();

        if (error) {
            console.error('Error marking all notifications as read:', error);
            return res.status(500).json({ error: 'Failed to mark all notifications as read' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Save a Web Push subscription
export const subscribePush = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        // Check if endpoint already exists
        const { data: existing } = await adminSupabase
            .from('push_subscriptions')
            .select('id')
            .eq('endpoint', subscription.endpoint)
            .single();

        if (existing) {
            return res.json({ message: 'Subscription already exists' });
        }

        const { error } = await adminSupabase
            .from('push_subscriptions')
            .insert([{
                user_id: userId,
                endpoint: subscription.endpoint,
                keys: subscription.keys
            }]);

        if (error) {
            console.error('Error saving push subscription:', error);
            return res.status(500).json({ error: 'Failed to save subscription' });
        }

        return res.json({ message: 'Subscribed successfully' });
    } catch (error) {
        console.error('Subscribe push error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Remove a Web Push subscription
export const unsubscribePush = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint is required' });
        }

        const { error } = await adminSupabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)
            .eq('user_id', userId);

        if (error) {
            console.error('Error removing push subscription:', error);
            return res.status(500).json({ error: 'Failed to remove subscription' });
        }

        return res.json({ message: 'Unsubscribed successfully' });
    } catch (error) {
        console.error('Unsubscribe push error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: Broadcast a notification
import { broadcastNotification } from '../services/notification.service';

export const broadcast = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Verify admin role (assuming user.role is attached, or we query it)
        const { data: userRecord } = await adminSupabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (!userRecord || (userRecord.role !== 'admin' && userRecord.role !== 'superadmin')) {
            return res.status(403).json({ error: 'Forbidden: Admins only' });
        }

        const { title, message, targetRole, type, icon, url } = req.body;
        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        // Fire and forget the broadcast (don't block the response)
        broadcastNotification(title, message, targetRole, type, icon, url);

        return res.json({ message: 'Broadcast initiated successfully' });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
