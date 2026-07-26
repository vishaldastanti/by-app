-- Migration: Add Provider Response to Reviews
-- Adds a field for service providers (homestay, guide, transport) to reply to reviews.

ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS provider_response TEXT,
ADD COLUMN IF NOT EXISTS provider_responded_at TIMESTAMPTZ;
