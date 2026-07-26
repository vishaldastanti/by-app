-- Migration to add weekend_price to homestays
ALTER TABLE public.homestays
ADD COLUMN IF NOT EXISTS weekend_price numeric(10,2);
