-- ═══════════════════════════════════════════════════════════════
-- Add RLS Policies for provider_blocked_dates
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.provider_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Providers can view their own blocked dates
CREATE POLICY "Providers can view own blocked dates"
  ON public.provider_blocked_dates
  FOR SELECT
  USING (auth.uid() = provider_id);

-- Providers can insert their own blocked dates
CREATE POLICY "Providers can insert own blocked dates"
  ON public.provider_blocked_dates
  FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

-- Providers can update their own blocked dates
CREATE POLICY "Providers can update own blocked dates"
  ON public.provider_blocked_dates
  FOR UPDATE
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

-- Providers can delete their own blocked dates
CREATE POLICY "Providers can delete own blocked dates"
  ON public.provider_blocked_dates
  FOR DELETE
  USING (auth.uid() = provider_id);

-- Public/Users can view all blocked dates for availability checking
CREATE POLICY "Anyone can view blocked dates"
  ON public.provider_blocked_dates
  FOR SELECT
  USING (true);

-- Admins can manage all blocked dates
CREATE POLICY "Admins can manage all blocked dates"
  ON public.provider_blocked_dates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'superadmin')
    )
  );
