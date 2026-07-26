import { supabase } from './config/supabase';
import dotenv from 'dotenv';
dotenv.config();

const adminId = "06ff126f-a2d0-450c-bb28-54f75e5b47f8"; // Gautam Kumar (admin)

// ── Homestay Seed Data ──
// Matching actual DB schema: id, name, slug, location, address, lat, lng,
// price_per_night, max_guests, amenities, images, host_id, is_available,
// is_published, avg_rating, review_count, created_at
const mockHomestays = [
  {
    id: "00000000-0000-0000-0000-300000000001",
    name: "Ganga Kinare Haveli",
    slug: "ganga-kinare-haveli",
    location: "Patna",
    price_per_night: 1500,
    max_guests: 6,
    amenities: ["Wifi", "Kitchen", "AC"],
    images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=800"],
    host_id: adminId,
    is_available: true,
    is_published: true,
    avg_rating: 4.8,
    review_count: 120,
  },
  {
    id: "00000000-0000-0000-0000-300000000002",
    name: "Bodhi Tree Retreat",
    slug: "bodhi-tree-retreat",
    location: "Bodh Gaya",
    price_per_night: 2200,
    max_guests: 4,
    amenities: ["Wifi", "Spa", "Garden"],
    images: ["https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=800"],
    host_id: adminId,
    is_available: true,
    is_published: true,
    avg_rating: 4.9,
    review_count: 245,
  },
  {
    id: "00000000-0000-0000-0000-300000000003",
    name: "Village Mud House",
    slug: "village-mud-house",
    location: "Madhubani",
    price_per_night: 900,
    max_guests: 4,
    amenities: ["Art Studio", "Bonfire", "Organic Food"],
    images: ["https://images.unsplash.com/photo-1510798831971-661eb04b3739?q=80&w=800"],
    host_id: adminId,
    is_available: true,
    is_published: true,
    avg_rating: 4.6,
    review_count: 85,
  },
  {
    id: "00000000-0000-0000-0000-300000000004",
    name: "Valmiki Jungle Cottage",
    slug: "valmiki-jungle-cottage",
    location: "West Champaran",
    price_per_night: 2500,
    max_guests: 4,
    amenities: ["Wildlife", "Bonfire", "Trekking"],
    images: ["https://images.unsplash.com/photo-1449156493391-d2cfa28e468b?q=80&w=800"],
    host_id: adminId,
    is_available: true,
    is_published: true,
    avg_rating: 4.9,
    review_count: 98,
  },
];

async function seed() {
  console.log("Seeding homestays...");
  for (const item of mockHomestays) {
    const { error } = await supabase
      .from('homestays')
      .upsert(item)
      .select();

    if (error) {
      console.error(`✗ Failed to seed homestay ${item.name}:`, error.message);
    } else {
      console.log(`✓ Seeded homestay: ${item.name}`);
    }
  }

  // Note: transports table does not exist yet in Supabase.
  // For transport bookings, the backend will default to total_amount = 0.
  // The booking will still be created successfully — the user just sees
  // the frontend price. To enable server-side price validation for
  // transports, create the 'transports' table in Supabase SQL Editor:
  //
  // CREATE TABLE IF NOT EXISTS public.transports (
  //   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  //   operator_name TEXT NOT NULL,
  //   vehicle_type TEXT NOT NULL,
  //   route_from TEXT NOT NULL,
  //   route_to TEXT NOT NULL,
  //   departure_time TEXT,
  //   arrival_time TEXT,
  //   price_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
  //   image_url TEXT,
  //   amenities JSONB DEFAULT '[]'::jsonb,
  //   is_available BOOLEAN DEFAULT true,
  //   provider_id UUID,
  //   created_at TIMESTAMPTZ DEFAULT now()
  // );
  // ALTER TABLE public.transports ENABLE ROW LEVEL SECURITY;
  // CREATE POLICY "Allow all for service role" ON public.transports FOR ALL USING (true) WITH CHECK (true);
  // GRANT SELECT ON public.transports TO anon, authenticated;
  // GRANT ALL ON public.transports TO service_role;
  
  console.log("\n✅ Seeding complete!");
}

seed();
