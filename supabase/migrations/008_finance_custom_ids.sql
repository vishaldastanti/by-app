-- Migration 008: Add human-readable custom_ids to finance tables

-- Add custom_id columns
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS custom_id varchar(50) UNIQUE;

ALTER TABLE public.payouts
ADD COLUMN IF NOT EXISTS custom_id varchar(50) UNIQUE;

-- Function to automatically generate custom IDs based on a prefix and the UUID
CREATE OR REPLACE FUNCTION generate_finance_custom_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.custom_id IS NULL THEN
        IF TG_TABLE_NAME = 'transactions' THEN
            -- e.g., TRX-A1B2C3D4
            NEW.custom_id := 'TRX-' || upper(substring(NEW.id::text from 1 for 8));
        ELSIF TG_TABLE_NAME = 'payouts' THEN
            -- e.g., PAY-A1B2C3D4
            NEW.custom_id := 'PAY-' || upper(substring(NEW.id::text from 1 for 8));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = '';

-- Triggers to auto-assign custom_id on insert
DROP TRIGGER IF EXISTS set_transactions_custom_id ON public.transactions;
CREATE TRIGGER set_transactions_custom_id
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION generate_finance_custom_id();

DROP TRIGGER IF EXISTS set_payouts_custom_id ON public.payouts;
CREATE TRIGGER set_payouts_custom_id
BEFORE INSERT ON public.payouts
FOR EACH ROW EXECUTE FUNCTION generate_finance_custom_id();

-- Update any existing rows if they don't have a custom_id yet
UPDATE public.transactions SET custom_id = 'TRX-' || upper(substring(id::text from 1 for 8)) WHERE custom_id IS NULL;
UPDATE public.payouts SET custom_id = 'PAY-' || upper(substring(id::text from 1 for 8)) WHERE custom_id IS NULL;
