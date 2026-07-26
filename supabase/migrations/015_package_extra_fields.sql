-- Add missing fields to packages table for the CMS
ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS provider varchar(255),
ADD COLUMN IF NOT EXISTS pickup_address varchar(255),
ADD COLUMN IF NOT EXISTS boarding_point varchar(255),
ADD COLUMN IF NOT EXISTS start_date varchar(100),
ADD COLUMN IF NOT EXISTS end_date varchar(100),
ADD COLUMN IF NOT EXISTS places_covered text,
ADD COLUMN IF NOT EXISTS booking_type varchar(50) DEFAULT 'enquiry';
