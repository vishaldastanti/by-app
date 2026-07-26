-- Migration 009: Add QR Check-in/Check-out fields to bookings

-- Add columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checkin_token uuid DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS cash_payment_confirmed_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cash_payment_note text;

-- Create index for fast QR scan lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_checkin_token ON public.bookings(checkin_token);

-- We don't alter the check constraint directly here if it's too complex,
-- but our application logic will start using 'checked_in' as a status.
-- Supabase varchar constraints might not strictly limit the ENUM if not defined as an ENUM type.
-- In the original migration (001_init.sql) it is just a varchar(20) with a DEFAULT 'pending'.
-- Wait, looking at 001_init.sql, status is just varchar(20) NOT NULL DEFAULT 'pending', there is no CHECK constraint on status in 001_init.sql!
-- So we can just start using 'checked_in' safely.
