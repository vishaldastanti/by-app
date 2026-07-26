-- Migration 004: Add missing CMS fields to packages and destinations

-- Packages missing fields
ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS category varchar(50) DEFAULT 'Spiritual',
ADD COLUMN IF NOT EXISTS route varchar(255),
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS rating decimal(3,2) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS stay_details varchar(255),
ADD COLUMN IF NOT EXISTS transport_details varchar(255),
ADD COLUMN IF NOT EXISTS meal_details varchar(255);

-- Destinations missing fields
ALTER TABLE public.destinations
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS price varchar(100),
ADD COLUMN IF NOT EXISTS rating decimal(3,2) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
