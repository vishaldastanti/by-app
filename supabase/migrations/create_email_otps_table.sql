CREATE TABLE IF NOT EXISTS public.email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON public.email_otps(email);
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON public.email_otps(expires_at);

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_otps' AND policyname = 'Service role only') THEN
    CREATE POLICY "Service role only" ON public.email_otps FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.email_otps TO service_role;
