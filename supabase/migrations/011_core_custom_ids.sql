-- Migration 011: Add custom_id columns to core tables with UNIQUE constraints
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add custom_id columns (if not already present)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_id varchar(50);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS custom_id varchar(50);
ALTER TABLE public.homestays ADD COLUMN IF NOT EXISTS custom_id varchar(50);
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS custom_id varchar(50);
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS custom_id varchar(50);
ALTER TABLE public.transports ADD COLUMN IF NOT EXISTS custom_id varchar(50);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS custom_id varchar(50);

-- 2. Add UNIQUE constraints (skip if already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_custom_id_unique') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_custom_id_unique UNIQUE (custom_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_custom_id_unique') THEN
        ALTER TABLE public.bookings ADD CONSTRAINT bookings_custom_id_unique UNIQUE (custom_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homestays_custom_id_unique') THEN
        ALTER TABLE public.homestays ADD CONSTRAINT homestays_custom_id_unique UNIQUE (custom_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'packages_custom_id_unique') THEN
        ALTER TABLE public.packages ADD CONSTRAINT packages_custom_id_unique UNIQUE (custom_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guides_custom_id_unique') THEN
        ALTER TABLE public.guides ADD CONSTRAINT guides_custom_id_unique UNIQUE (custom_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transports_custom_id_unique') THEN
        ALTER TABLE public.transports ADD CONSTRAINT transports_custom_id_unique UNIQUE (custom_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_custom_id_unique') THEN
        ALTER TABLE public.reviews ADD CONSTRAINT reviews_custom_id_unique UNIQUE (custom_id);
    END IF;
END $$;

-- 3. Backfill any rows that are missing custom_id values
-- Users
UPDATE public.users SET custom_id = 'BY-' || upper(replace(role, '_', '')) || '-' || upper(substring(id::text from 1 for 6))
WHERE custom_id IS NULL;

-- Bookings
UPDATE public.bookings SET custom_id = CASE
    WHEN service_type = 'homestay' THEN 'BY-H-BKG-'
    WHEN service_type = 'package' THEN 'BY-P-BKG-'
    WHEN service_type = 'guide' THEN 'BY-G-BKG-'
    WHEN service_type = 'transport' THEN 'BY-T-BKG-'
    ELSE 'BY-BKG-'
END || upper(substring(id::text from 1 for 6))
WHERE custom_id IS NULL;

-- Homestays
UPDATE public.homestays SET custom_id = 'BY-HMS-' || upper(substring(id::text from 1 for 6))
WHERE custom_id IS NULL;

-- Packages
UPDATE public.packages SET custom_id = 'BY-PKG-' || upper(substring(id::text from 1 for 6))
WHERE custom_id IS NULL;

-- Guides
UPDATE public.guides SET custom_id = 'BY-GDE-' || upper(substring(id::text from 1 for 6))
WHERE custom_id IS NULL;

-- Transports
UPDATE public.transports SET custom_id = 'BY-TRN-' || upper(substring(id::text from 1 for 6))
WHERE custom_id IS NULL;

-- Reviews
UPDATE public.reviews SET custom_id = 'BY-RVW-' || upper(substring(id::text from 1 for 6))
WHERE custom_id IS NULL;
