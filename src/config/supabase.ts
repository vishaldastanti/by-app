import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import { Request } from 'express';

// Used strictly for operations that must bypass RLS (e.g. webhooks, cron jobs, admin-only routes)
export const adminSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Used for all user-facing requests. Since custom JWTs are used for authentication via middleware,
// passing them to Supabase Anon Key causes RLS failures. Thus, we return adminSupabase and
// rely on controller-level user filtering (which is already implemented).
export const getSupabaseClient = (req?: Request) => {
  return adminSupabase;
};

// Fallback for files not yet migrated (will be removed later)
export const supabase = adminSupabase;
