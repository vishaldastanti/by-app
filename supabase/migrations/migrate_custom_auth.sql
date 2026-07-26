-- Migration: Remove Supabase Auth dependency from public.users
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Drop the trigger that syncs auth.users → public.users (no longer needed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Drop the foreign key constraint linking public.users.id to auth.users.id
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 3. Add password_hash and is_verified columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- 4. Set default for id to auto-generate UUIDs (no longer from auth.users)
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 5. Update RLS policies to not depend on auth.uid()
-- Drop old policies that reference auth.uid()
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Since we use service_role key from the backend, we need a permissive policy
CREATE POLICY "Service role full access" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;
