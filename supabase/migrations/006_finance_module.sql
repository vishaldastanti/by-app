-- 12. Create Transactions (Ledger) Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    provider_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    amount numeric(10,2) NOT NULL,
    type varchar(50) NOT NULL CHECK (type IN ('payment_received', 'commission_deducted', 'payout_processed', 'refund')),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    reference_no varchar(100),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 13. Create Payouts Table
CREATE TABLE IF NOT EXISTS public.payouts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    amount numeric(10,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid')),
    paid_at timestamptz,
    reference_no varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to update updated_at on payouts
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = '';

CREATE TRIGGER update_payouts_modtime
BEFORE UPDATE ON public.payouts
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Policies for transactions
-- Admin can do everything
CREATE POLICY "Admin full access to transactions" ON public.transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
-- Providers can read their own transactions
CREATE POLICY "Providers can read own transactions" ON public.transactions FOR SELECT USING (
  auth.uid() = provider_id
);

-- Policies for payouts
-- Admin can do everything
CREATE POLICY "Admin full access to payouts" ON public.payouts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
-- Providers can read their own payouts
CREATE POLICY "Providers can read own payouts" ON public.payouts FOR SELECT USING (
  auth.uid() = provider_id
);
