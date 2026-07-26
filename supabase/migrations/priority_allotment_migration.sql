-- Migration: Add room inventory tracking and allotment to bookings

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS allotted_rooms text,
ADD COLUMN IF NOT EXISTS booked_rooms integer DEFAULT 1;
