-- Migration: User Dashboard Tables (Corrected)
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Table for Extended User Profiles / Preferences
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    age INT,
    gender TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    dietary_pref TEXT DEFAULT 'Any', -- e.g., Veg, Non-Veg, Jain
    accessibility_needs TEXT,
    languages TEXT[], -- Array of strings e.g., ['English', 'Hindi']
    id_proof_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access profiles" ON public.user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Add Unique Constraint to existing reviews table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reviews_booking_id_key'
    ) THEN
        ALTER TABLE public.reviews ADD CONSTRAINT reviews_booking_id_key UNIQUE (booking_id);
    END IF;
END $$;
