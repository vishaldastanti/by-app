-- 1. Create System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key varchar(100) PRIMARY KEY,
    value jsonb NOT NULL,
    description text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert Default Cancellation Policy
INSERT INTO public.system_settings (key, value, description)
VALUES (
    'cancellation_policy',
    '[{"days_before": 7, "refund_percentage": 100}, {"days_before": 3, "refund_percentage": 50}]'::jsonb,
    'Array of objects defining refund percentages based on days before check-in.'
) ON CONFLICT (key) DO NOTHING;

-- 2. Create Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id),
    amount numeric(10,2) NOT NULL,
    currency varchar(3) DEFAULT 'INR',
    razorpay_refund_id varchar(100),
    razorpay_payment_id varchar(100) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'rejected')),
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to update modified_at
CREATE TRIGGER update_refunds_modtime
BEFORE UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Policies for system_settings
-- Anyone can read
CREATE POLICY "Public read for system_settings" ON public.system_settings FOR SELECT USING (true);
-- Only admin can update
CREATE POLICY "Admin update for system_settings" ON public.system_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admin insert for system_settings" ON public.system_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Policies for refunds
-- Admin can do everything
CREATE POLICY "Admin full access to refunds" ON public.refunds FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
-- Users can read their own refunds
CREATE POLICY "Users can read own refunds" ON public.refunds FOR SELECT USING (
  auth.uid() = user_id
);
