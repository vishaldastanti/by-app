-- Add cancellation_policy to service tables
ALTER TABLE public.homestays ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;
ALTER TABLE public.transports ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;

-- Create service_policy_approvals table
CREATE TABLE IF NOT EXISTS public.service_policy_approvals (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type varchar(50) NOT NULL CHECK (service_type IN ('homestay', 'guide', 'transport', 'package')),
    service_id uuid NOT NULL,
    provider_id uuid NOT NULL REFERENCES public.users(id),
    proposed_policy jsonb NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to update modified_at
CREATE OR REPLACE FUNCTION update_service_policy_approvals_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = '';

CREATE TRIGGER update_service_policy_approvals_modtime
BEFORE UPDATE ON public.service_policy_approvals
FOR EACH ROW EXECUTE FUNCTION update_service_policy_approvals_modtime();

-- Enable RLS
ALTER TABLE public.service_policy_approvals ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin can do everything
CREATE POLICY "Admin full access to policy approvals" ON public.service_policy_approvals FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'approval_manager'))
);

-- Providers can read and insert their own requests
CREATE POLICY "Providers can read own policy approvals" ON public.service_policy_approvals FOR SELECT USING (
  auth.uid() = provider_id
);

CREATE POLICY "Providers can insert own policy approvals" ON public.service_policy_approvals FOR INSERT WITH CHECK (
  auth.uid() = provider_id
);
