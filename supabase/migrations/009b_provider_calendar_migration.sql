-- ═══════════════════════════════════════════════════════════════
-- Provider Blocked Dates — Calendar Block/Unblock System
-- Run this migration against your Supabase database
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS provider_blocked_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('homestay', 'transport', 'guide')),
    service_id UUID NOT NULL,
    blocked_date DATE NOT NULL,
    reason TEXT DEFAULT 'unavailable',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate blocks for the same service on the same date
    UNIQUE (service_id, blocked_date)
);

-- Index for fast lookups by provider
CREATE INDEX IF NOT EXISTS idx_blocked_dates_provider ON provider_blocked_dates(provider_id);

-- Index for fast lookups by service + date range (calendar queries)
CREATE INDEX IF NOT EXISTS idx_blocked_dates_service ON provider_blocked_dates(service_id, blocked_date);
