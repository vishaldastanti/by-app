import webpush from 'web-push';
import { env } from '../config/env';
import { adminSupabase } from '../config/supabase';

// Configure Web Push with VAPID keys
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${env.ADMIN_EMAIL}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID keys are missing. Web push notifications will not work.');
}

/**
 * Creates a notification in the database and simultaneously sends a Web Push notification
 * to all devices registered by the user.
 * 
 * @param userId - UUID of the user
 * @param title - Notification title
 * @param message - Notification message body
 * @param type - Type of notification (e.g. 'booking', 'system', 'promo')
 * @param icon - Optional icon string (e.g. 'fas fa-check')
 * @param url - Optional URL to open when the push notification is clicked
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string = 'system',
  icon: string = 'fas fa-bell text-gray-500',
  url: string = '/'
) {
  try {
    // 1. Insert the in-app notification into the database
    const { data: notification, error } = await adminSupabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          title,
          message,
          type,
          icon,
          is_read: false,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('[NotificationService] Failed to insert notification into DB:', error);
      return;
    }

    // 2. Fetch all push subscriptions for this user
    const { data: subscriptions, error: subError } = await adminSupabase
      .from('push_subscriptions')
      .select('id, endpoint, keys')
      .eq('user_id', userId);

    if (subError) {
      console.error('[NotificationService] Failed to fetch subscriptions:', subError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      // User has no registered devices for push notifications
      return;
    }

    // 3. Prepare the push payload
    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/android-chrome-192x192.png', // Ensure this exists in frontend public folder
      badge: '/icon-96x96.png', // Ensure this exists in frontend public folder
      data: {
        url, // The Service Worker will read this to open the correct page
      }
    });

    // 4. Send the push notification to all endpoints concurrently
    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as any,
          },
          payload
        );
      } catch (err: any) {
        // If the subscription is gone or expired (status 410 or 404), delete it from DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[NotificationService] Subscription expired for ${sub.endpoint}, removing from DB.`);
          await adminSupabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error(`[NotificationService] Error sending push to ${sub.endpoint}:`, err);
        }
      }
    });

    await Promise.all(pushPromises);

  } catch (error) {
    console.error('[NotificationService] General error:', error);
  }
}

/**
 * Broadcasts a notification to a specific audience role and triggers web push.
 */
export async function broadcastNotification(
  title: string,
  message: string,
  targetRole: string = 'all',
  type: string = 'promo',
  icon: string = 'fas fa-bullhorn text-orange-500',
  url: string = '/'
) {
  try {
    // 1. Fetch users matching the role
    let userQuery = adminSupabase.from('users').select('id');
    if (targetRole !== 'all') {
      userQuery = userQuery.eq('role', targetRole);
    }

    const { data: users, error: userError } = await userQuery;

    if (userError) {
      console.error('[NotificationService] Failed to fetch users for broadcast:', userError);
      return;
    }

    if (!users || users.length === 0) return;

    // 2. Prepare notifications for DB insertion
    const dbNotifications = users.map(u => ({
      user_id: u.id,
      title,
      message,
      type,
      icon,
      is_read: false,
      related_entity_type: url ? `url:${url}` : null,
    }));

    // Batch insert (Supabase supports inserting an array)
    const { error: insertError } = await adminSupabase
      .from('notifications')
      .insert(dbNotifications);

    if (insertError) {
      console.error('[NotificationService] Failed to bulk insert notifications:', insertError);
    }

    // 3. Fetch push subscriptions for targeted users
    let subQuery = adminSupabase.from('push_subscriptions').select('id, endpoint, keys, user_id');
    if (targetRole !== 'all') {
      // If we only target a specific role, we need to filter the subscriptions by user_id
      const userIds = users.map(u => u.id);
      subQuery = subQuery.in('user_id', userIds);
    }

    const { data: subscriptions, error: subError } = await subQuery;

    if (subError || !subscriptions || subscriptions.length === 0) {
      return;
    }

    // 4. Send web push notifications
    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: { url }
    });

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys as any }, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await adminSupabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    });

    await Promise.all(pushPromises);

  } catch (error) {
    console.error('[NotificationService] Broadcast error:', error);
  }
}
