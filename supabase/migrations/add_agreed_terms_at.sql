-- Migration to add agreed_terms_at timestamp to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS agreed_terms_at timestamptz;
