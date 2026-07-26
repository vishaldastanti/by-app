require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function runMissingSQL() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Running missing SQL from migrate-tables.ts...');

    const sql = `
-- 1. Create transports table
CREATE TABLE IF NOT EXISTS public.transports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  route_from TEXT NOT NULL,
  route_to TEXT NOT NULL,
  departure_time TEXT,
  arrival_time TEXT,
  price_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  amenities JSONB DEFAULT '[]'::jsonb,
  is_available BOOLEAN DEFAULT true,
  provider_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1b. Add Provider Verification Columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50) DEFAULT 'pending_setup',
  ADD COLUMN IF NOT EXISTS legal_documents JSONB DEFAULT '{}'::jsonb;

-- 2. Add new columns for CMS frontend fields
ALTER TABLE public.destinations 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price VARCHAR(50),
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

ALTER TABLE public.homestays 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS badge VARCHAR(50),
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

ALTER TABLE public.packages 
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS route VARCHAR(150),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS stay_details TEXT,
  ADD COLUMN IF NOT EXISTS transport_details TEXT,
  ADD COLUMN IF NOT EXISTS meal_details TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS boarding_point TEXT,
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS places_covered TEXT;

-- 3. Enable RLS on transports
ALTER TABLE public.transports ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy for authenticated access
CREATE POLICY "Allow all for service role" ON public.transports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Grant access to the anon and authenticated roles
GRANT SELECT ON public.transports TO anon, authenticated;
GRANT ALL ON public.transports TO service_role;

-- 6. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  is_read BOOLEAN DEFAULT false,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow all for service role" ON public.notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 7. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow all for service role" ON public.push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- 8. REFRESH SCHEMA CACHE FOR POSTGREST
NOTIFY pgrst, 'reload schema';
    `;

    await client.query(sql);
    console.log('✅ Missing SQL applied successfully.');
    console.log('✅ PostgREST Schema Cache reloaded.');
  } catch (err) {
    console.error('❌ Error applying missing SQL:', err);
  } finally {
    await client.end();
  }
}

runMissingSQL();
