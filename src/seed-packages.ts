import { supabase } from './config/supabase';
import dotenv from 'dotenv';
dotenv.config();

const adminId = "06ff126f-a2d0-450c-bb28-54f75e5b47f8"; // Gautam Kumar (admin)

const mockPackages = [
  {
    id: "a1b2c3d4-1234-4567-89ab-cdef01234567",
    title: "The Enlightenment Trail",
    slug: "the-enlightenment-trail",
    duration_days: 3,
    duration_nights: 2,
    price_per_person: 14999.00,
    cover_image_url: "https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800",
    destination_ids: [],
    itinerary: [
      { day: "Day 1", title: "Patna ➔ Bodh Gaya", description: "Arrival in Patna. Direct transfer to Bodh Gaya. Evening at the Mahabodhi Temple complex to meditate under the sacred Bodhi Tree.", meals: ["dinner"] },
      { day: "Day 2", title: "Rajgir ➔ Nalanda", description: "Take the aerial ropeway to the Vishwa Shanti Stupa in Rajgir, and wander through the red-brick ruins of Nalanda, the world's oldest residential university.", meals: ["breakfast", "dinner"] },
      { day: "Day 3", title: "Departure", description: "Breakfast and return to Patna for onward journey.", meals: ["breakfast"] }
    ],
    includes: ["2 Nights at a Premium Bodh Gaya Heritage Homestay", "AC Sedan for 3 Days", "Certified ASI (Archaeological Survey of India) Guide in Nalanda"],
    excludes: ["Personal Expenses", "Airfare/Train Tickets"],
    max_group_size: 15,
    difficulty: "easy",
    is_published: true,
    created_by: adminId
  },
  {
    id: "b2c3d4e5-2345-5678-9abc-def012345678",
    title: "The Magadh Empire Grand Tour",
    slug: "the-magadh-empire-grand-tour",
    duration_days: 5,
    duration_nights: 4,
    price_per_person: 24999.00,
    cover_image_url: "https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800",
    destination_ids: [],
    itinerary: [
      { day: "Day 1", title: "Patna ➔ Vaishali", description: "Arrival in Patna. Travel to Vaishali to see the Ashokan Pillar (the world's first republic).", meals: ["dinner"] },
      { day: "Day 2", title: "Rajgir", description: "Travel to Rajgir. Soak in the natural hot springs and explore the ancient Cyclopean Wall.", meals: ["breakfast", "dinner"] },
      { day: "Day 3", title: "Barabar Caves ➔ Bodh Gaya", description: "Explore the mystical Barabar Caves (India's oldest rock-cut caves) and arrive in Bodh Gaya.", meals: ["breakfast", "dinner"] },
      { day: "Day 4", title: "Gaya Aarti", description: "Experience the evening Aarti at the Vishnupad Temple.", meals: ["breakfast", "dinner"] },
      { day: "Day 5", title: "Return to Patna", description: "Breakfast and departure to Patna.", meals: ["breakfast"] }
    ],
    includes: ["2 Nights in Patna, 1 Night in Rajgir, 1 Night in Gaya", "SUV Transport (Innova/Ertiga) for 5 Days", "VIP Temple Access & Expert Local Storytellers"],
    excludes: ["Personal Expenses", "Airfare/Train Tickets"],
    max_group_size: 10,
    difficulty: "moderate",
    is_published: true,
    created_by: adminId
  },
  {
    id: "c3d4e5f6-3456-6789-abcd-ef0123456789",
    title: "The Valmiki Safari Escape",
    slug: "the-valmiki-safari-escape",
    duration_days: 3,
    duration_nights: 2,
    price_per_person: 12999.00,
    cover_image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Valmiki_Nagar_Tiger_Reserve.jpg/800px-Valmiki_Nagar_Tiger_Reserve.jpg",
    destination_ids: [],
    itinerary: [
      { day: "Day 1", title: "Patna ➔ Valmiki Tiger Reserve", description: "Travel to West Champaran. Discover the untold natural beauty of Bihar. Stay in eco-huts near the Nepal border.", meals: ["dinner"] },
      { day: "Day 2", title: "Jungle Safari", description: "Embark on early morning jungle safaris to spot Bengal Tigers and Indian Leopards. Afternoon serene boat ride on the Gandak River.", meals: ["breakfast", "lunch", "dinner"] },
      { day: "Day 3", title: "Return Departure", description: "Morning breakfast and departure back to Patna.", meals: ["breakfast"] }
    ],
    includes: ["2 Nights in Forest Department Eco-Huts or Verified Local Lodge", "2 Guided Open-Jeep Jungle Safaris", "Round-trip AC Transport from Patna"],
    excludes: ["Camera Fees", "Travel Insurance"],
    max_group_size: 6,
    difficulty: "moderate",
    is_published: true,
    created_by: adminId
  },
  {
    id: "d4e5f6a7-4567-789a-bcde-f0123456789a",
    title: "The Divine Pilgrimage",
    slug: "the-divine-pilgrimage",
    duration_days: 2,
    duration_nights: 1,
    price_per_person: 8999.00,
    cover_image_url: "https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800",
    destination_ids: [],
    itinerary: [
      { day: "Day 1", title: "Patna Sahib Arrival", description: "Begin with blessings at Takht Sri Harmandir Ji (birthplace of Guru Gobind Singh Ji) in Patna Sahib.", meals: ["dinner"] },
      { day: "Day 2", title: "Gaya Rituals", description: "Seamless, respectful journey to Gaya for ancestral rituals (Pind Daan) along the Falgu River. Evening return to Patna.", meals: ["breakfast"] }
    ],
    includes: ["1 Night at a Verified Veg-Only Homestay", "Dedicated AC Transport", "Local religious guide (Pandit/Sevadar coordination)"],
    excludes: ["Personal Expenses", "Airfare/Train Tickets"],
    max_group_size: 8,
    difficulty: "easy",
    is_published: true,
    created_by: adminId
  },
  {
    id: "e5f6a7b8-5678-89ab-cdef-0123456789ab",
    title: "The Forgotten Fortresses",
    slug: "the-forgotten-fortresses",
    duration_days: 3,
    duration_nights: 2,
    price_per_person: 9999.00,
    cover_image_url: "https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800",
    destination_ids: [],
    itinerary: [
      { day: "Day 1", title: "Patna ➔ Sasaram", description: "Travel to Sasaram. Marvel at the architectural genius of Sher Shah Suri’s Tomb (which rivals the Taj Mahal).", meals: ["dinner"] },
      { day: "Day 2", title: "Rohtasgarh Fort Hike", description: "Hike up to the massive, unconquered Rohtasgarh Fort perched on a limestone plateau in the rugged beauty of the Kaimur range.", meals: ["breakfast", "dinner"] },
      { day: "Day 3", title: "Return to Patna", description: "Breakfast and departure for Patna.", meals: ["breakfast"] }
    ],
    includes: ["2 Nights in Sasaram/Rohtas verified accommodations", "Local Trekking Guide for the Fort hike", "Transport (SUV or Motorcycle rental option)"],
    excludes: ["Personal Expenses", "Airfare/Train Tickets"],
    max_group_size: 10,
    difficulty: "moderate",
    is_published: true,
    created_by: adminId
  }
];

async function seed() {
  console.log("Seeding packages...");
  for (const pkg of mockPackages) {
    const { data, error } = await supabase
      .from('packages')
      .upsert(pkg)
      .select();

    if (error) {
      console.error(`Failed to seed ${pkg.title}:`, error.message);
    } else {
      console.log(`Successfully seeded package: ${pkg.title}`);
    }
  }
}

seed();
