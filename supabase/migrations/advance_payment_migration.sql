-- Migration: Add advance_amount column and update payment_status constraint
-- This supports the "Pay at Location with 20% advance" feature

-- Add advance_amount column to store the advance payment amount
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS advance_amount numeric(10,2) DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN bookings.advance_amount IS 'Amount paid as advance (20% of total) for pay-at-location bookings';

-- Note: payment_status values are now: 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
