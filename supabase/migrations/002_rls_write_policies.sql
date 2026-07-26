-- ──────────────────────────────────────────────────────────
-- HIGH-1 FIX: Add INSERT/UPDATE/DELETE RLS policies
-- Previously, only SELECT policies existed. The service_role
-- key bypasses RLS, but these policies add defense-in-depth
-- and protect against direct database access.
-- ──────────────────────────────────────────────────────────

-- ═══ UTILITY FUNCTIONS ═══
-- SECURITY DEFINER bypasses RLS, preventing infinite recursion when checking user roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$;

-- ═══ USERS TABLE ═══
-- Users can update their own profile (name, phone, avatar only — role is not changeable via RLS)
CREATE POLICY "Users can update own profile" 
  ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin users can view all profiles
CREATE POLICY "Admins can view all users" 
  ON public.users 
  FOR SELECT 
  USING (public.is_admin());

-- ═══ BOOKINGS TABLE ═══
-- Users can create their own bookings
CREATE POLICY "Users can create own bookings" 
  ON public.bookings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookings (e.g. cancel)
CREATE POLICY "Users can update own bookings" 
  ON public.bookings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Admins can manage all bookings
CREATE POLICY "Admins can manage all bookings" 
  ON public.bookings 
  FOR ALL 
  USING (public.is_admin());

-- ═══ HOMESTAYS TABLE ═══
-- Providers can manage their own homestays
CREATE POLICY "Providers can manage own homestays" 
  ON public.homestays 
  FOR ALL 
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Admins can manage all homestays
CREATE POLICY "Admins can manage all homestays" 
  ON public.homestays 
  FOR ALL 
  USING (public.is_admin());

-- ═══ DESTINATIONS TABLE ═══
-- Admins can manage destinations
CREATE POLICY "Admins can manage destinations" 
  ON public.destinations 
  FOR ALL 
  USING (public.is_admin());

-- ═══ PACKAGES TABLE ═══
-- Admins can manage packages
CREATE POLICY "Admins can manage packages" 
  ON public.packages 
  FOR ALL 
  USING (public.is_admin());

-- ═══ REVIEWS TABLE ═══
-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews" 
  ON public.reviews 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update/delete their own reviews
CREATE POLICY "Users can manage own reviews" 
  ON public.reviews 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" 
  ON public.reviews 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ═══ SAVED ITINERARIES TABLE ═══
-- LOW-3 FIX: Users can read their own saved itineraries
CREATE POLICY "Users can view own itineraries" 
  ON public.saved_itineraries 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can create their own itineraries
CREATE POLICY "Users can create itineraries" 
  ON public.saved_itineraries 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own itineraries
CREATE POLICY "Users can delete own itineraries" 
  ON public.saved_itineraries 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ═══ REFRESH TOKENS TABLE ═══
-- Users can manage their own refresh tokens
CREATE POLICY "Users can manage own tokens" 
  ON public.refresh_tokens 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
