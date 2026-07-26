-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Users Table (in public schema)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    email varchar(255) NOT NULL UNIQUE,
    phone varchar(15),
    role varchar(20) NOT NULL DEFAULT 'traveller', -- guest | traveller | provider | admin | superadmin
    avatar_url text,
    provider_type varchar(20), -- NULL | homestay | guide | transport
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.1 Sync Trigger: Automatically create public.users row when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', ''), 
    new.email, 
    new.raw_user_meta_data->>'phone',
    COALESCE(new.raw_user_meta_data->>'role', 'traveller')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. Create Refresh Tokens Table
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create Destinations Table
CREATE TABLE IF NOT EXISTS public.destinations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(150) NOT NULL,
    slug varchar(150) NOT NULL UNIQUE,
    tagline varchar(255),
    category varchar(50) NOT NULL, -- heritage | spiritual | nature | cultural
    location varchar(100) NOT NULL,
    hero_image_url text,
    sections jsonb, -- [{header, content}]
    highlights jsonb, -- [string]
    best_time varchar(100),
    lat decimal(9,6),
    lng decimal(9,6),
    tags jsonb, -- [string]
    is_published boolean NOT NULL DEFAULT false,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create Packages Table
CREATE TABLE IF NOT EXISTS public.packages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title varchar(200) NOT NULL,
    slug varchar(200) NOT NULL UNIQUE,
    duration_days integer NOT NULL,
    duration_nights integer NOT NULL,
    price_per_person numeric(10,2) NOT NULL,
    cover_image_url text,
    destination_ids jsonb NOT NULL, -- [uuid]
    itinerary jsonb NOT NULL, -- [{day, title, description, meals}]
    includes jsonb, -- [string]
    excludes jsonb, -- [string]
    max_group_size integer,
    difficulty varchar(20), -- easy | moderate | challenging
    is_published boolean NOT NULL DEFAULT false,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create Homestays Table
CREATE TABLE IF NOT EXISTS public.homestays (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(150) NOT NULL,
    slug varchar(150) NOT NULL UNIQUE,
    location varchar(100) NOT NULL,
    address text,
    lat decimal(9,6),
    lng decimal(9,6),
    price_per_night numeric(10,2) NOT NULL,
    max_guests integer NOT NULL,
    amenities jsonb NOT NULL, -- [string]
    images jsonb, -- [string]
    host_id uuid NOT NULL REFERENCES public.users(id),
    is_available boolean NOT NULL DEFAULT true,
    is_published boolean NOT NULL DEFAULT false,
    avg_rating numeric(3,2),
    review_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Create Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    service_type varchar(20) NOT NULL, -- package | homestay | transport | guide
    service_id uuid NOT NULL,
    service_name varchar(200) NOT NULL,
    check_in date,
    check_out date,
    guests integer NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled | completed
    razorpay_order_id varchar(100),
    razorpay_payment_id varchar(100),
    payment_status varchar(20) NOT NULL DEFAULT 'unpaid', -- unpaid | paid | refunded
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type varchar(20) NOT NULL,
    service_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users(id),
    booking_id uuid REFERENCES public.bookings(id),
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Create Saved Itineraries Table
CREATE TABLE IF NOT EXISTS public.saved_itineraries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    title varchar(200) NOT NULL,
    preferences jsonb NOT NULL, -- {budget, days, interests, group_type, from_location}
    itinerary jsonb NOT NULL, -- Gemini response
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homestays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_itineraries ENABLE ROW LEVEL SECURITY;

-- 11. Basic RLS Policies (Simplified for Week 1)
-- Users can see their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
-- Destinations are public
CREATE POLICY "Public read for destinations" ON public.destinations FOR SELECT USING (true);
-- Packages are public
CREATE POLICY "Public read for packages" ON public.packages FOR SELECT USING (true);
-- Homestays are public
CREATE POLICY "Public read for homestays" ON public.homestays FOR SELECT USING (true);
-- Bookings: user can see own
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
-- Reviews: public read
CREATE POLICY "Public read for reviews" ON public.reviews FOR SELECT USING (true);
