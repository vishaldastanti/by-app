-- Migration 007: Add detailed fields to homestays

ALTER TABLE public.homestays
ADD COLUMN IF NOT EXISTS room_images jsonb DEFAULT '{"room": [], "lobby": [], "entrance": [], "reception": [], "public_area": []}'::jsonb,
ADD COLUMN IF NOT EXISTS exact_location text,
ADD COLUMN IF NOT EXISTS map_location_url text,
ADD COLUMN IF NOT EXISTS room_type varchar(100),
ADD COLUMN IF NOT EXISTS rules_and_policies text,
ADD COLUMN IF NOT EXISTS checkout_time varchar(50),
ADD COLUMN IF NOT EXISTS max_adults integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_children integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bed_type varchar(50),
ADD COLUMN IF NOT EXISTS ac_type varchar(50),
ADD COLUMN IF NOT EXISTS number_of_rooms integer DEFAULT 1;
