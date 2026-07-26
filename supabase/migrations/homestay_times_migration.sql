-- Add checkin_time and checkout_time to homestays table
ALTER TABLE public.homestays 
ADD COLUMN IF NOT EXISTS checkin_time time NOT NULL DEFAULT '12:00:00',
ADD COLUMN IF NOT EXISTS checkout_time time NOT NULL DEFAULT '11:00:00';
