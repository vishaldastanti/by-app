-- Migration: Create Transports and Guides Tables

-- Create Transports Table
CREATE TABLE IF NOT EXISTS public.transports (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_category varchar(100) NOT NULL,
    fleet_size integer NOT NULL DEFAULT 1,
    daily_price numeric(10,2) NOT NULL,
    route_from varchar(100) NOT NULL,
    route_to varchar(100) NOT NULL,
    provider_id uuid NOT NULL REFERENCES public.users(id),
    is_available boolean NOT NULL DEFAULT true,
    is_published boolean NOT NULL DEFAULT false,
    avg_rating numeric(3,2),
    review_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create Guides Table
CREATE TABLE IF NOT EXISTS public.guides (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    experience_years integer NOT NULL DEFAULT 0,
    languages jsonb, -- [string]
    specialties jsonb, -- [string]
    provider_id uuid NOT NULL REFERENCES public.users(id),
    is_available boolean NOT NULL DEFAULT true,
    is_published boolean NOT NULL DEFAULT false,
    avg_rating numeric(3,2),
    review_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Public read for transports" ON public.transports FOR SELECT USING (true);
CREATE POLICY "Public read for guides" ON public.guides FOR SELECT USING (true);
