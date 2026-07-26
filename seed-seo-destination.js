const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://edxczodmjnthfhdtrjlm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkeGN6b2Rtam50aGZoZHRyamxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE5ODMwNiwiZXhwIjoyMDg1Nzc0MzA2fQ.8DPZ1bc7QQgYOa9Udhp2ejt4s_d-MAtEQPS10boryHc';

const supabase = createClient(supabaseUrl, supabaseKey);

const seoDestination = {
  name: 'Madhubani',
  slug: 'madhubani-tourism-bihar',
  tagline: 'The Global Hub of Mithila Art and Culture',
  description: 'Geographically situated in the heart of the historic Mithila region of North Bihar (Latitude 26.35° N, Longitude 86.08° E), Madhubani is an internationally acclaimed destination for its vibrant indigenous art form. Renowned as the birthplace of Madhubani (Mithila) paintings—which hold a coveted Geographical Indication (GI) tag—this district offers an unparalleled rural and cultural tourism experience. Bordering Nepal to the north, Madhubani provides visitors a unique opportunity to interact with world-famous local artisans in villages like Jitwarpur and Ranti. Explore ancient temples like Kapileshwar Nath, wander through lush agricultural landscapes, and experience authentic Bihari village life just a short drive from Darbhanga.',
  category: 'cultural',
  location: 'Madhubani District, North Bihar (26.35° N, 86.08° E)',
  hero_image_url: 'https://via.placeholder.com/800x600?text=Madhubani',
  highlights: ['Madhubani Painting Villages', 'Kapileshwar Nath Temple', 'Saurath Sabha', 'Uchaith Bhagwati Temple', 'Rural Craft Tourism'],
  best_time: 'October — March',
  price: '₹600',
  rating: 4.8,
  review_count: 410,
  is_published: true,
  sections: [
    { 
      header: 'Geo-Location & Cultural Significance (Why Visit Madhubani?)', 
      content: '<p>Positioned geographically in the northernmost part of Bihar, sharing an international border with Nepal, Madhubani acts as the cultural nucleus of the ancient <strong>Mithila kingdom</strong>. The land is crisscrossed by several rivers flowing from the Himalayas, making its soil incredibly fertile.</p><p>The city\'s biggest draw is <em>Mithila Art (Madhubani Paintings)</em>. What began as a traditional practice of painting village mud walls using natural plant dyes has now transformed into a globally recognized art form. Visiting the geographical source of this art allows tourists to buy authentic pieces directly from National Award-winning artisans.</p>',
      image_url: ''
    },
    { 
      header: 'Top Local Attractions & Art Villages', 
      content: '<ul><li><strong>Jitwarpur & Ranti Villages:</strong> The most famous geographical hubs for Madhubani art. Take guided walking tours through these rural villages where almost every household is engaged in painting.</li><li><strong>Kapileshwar Nath Temple:</strong> A highly revered ancient Shiva temple located in the Kakraugh village area.</li><li><strong>Saurath Sabha:</strong> A historically significant village near Madhubani town famous for the annual gathering of Maithil Brahmins to negotiate marriages based on astrological charts.</li><li><strong>Uchaith Bhagwati Temple:</strong> Located in the Benipatti subdivision, this temple is dedicated to Goddess Durga and holds deep mythological importance involving the great poet Kalidasa.</li></ul>',
      image_url: ''
    },
    {
      header: 'How to Reach Madhubani (Geo-Optimized Routes)',
      content: '<p>Madhubani boasts strategic geo-spatial connectivity across North Bihar.</p><ul><li><strong>By Air:</strong> The closest and most convenient airport is <strong>Darbhanga Airport (DBR)</strong>, located just 35 km (approx. 1 hour drive) south of Madhubani. Jay Prakash Narayan International Airport in Patna is about 170 km away.</li><li><strong>By Train:</strong> <strong>Madhubani Railway Station (MBI)</strong> is well-connected to major Indian cities including New Delhi, Kolkata, and Mumbai via the East Central Railway network.</li><li><strong>By Road (NH-57 & SH-52):</strong> Easily accessible by road from Darbhanga (35 km), Patna (170 km), and Muzaffarpur (100 km). State transport buses and private taxis are abundantly available.</li></ul>',
      image_url: ''
    }
  ]
};

async function seedSEO() {
  console.log('🌱 Upserting geo-optimized destination into Supabase...\n');

  const { data, error } = await supabase
    .from('destinations')
    .upsert(
      { ...seoDestination }, 
      { onConflict: 'slug' }
    )
    .select('id, name, slug')
    .single();

  if (error) {
    console.error(`❌ Failed to upsert "${seoDestination.name}":`, error.message);
  } else {
    console.log(`✅ Successfully Geo-Optimized & Upserted "${data.name}" → /destinations/${data.slug} (id: ${data.id})`);
  }

  console.log('\n🎉 Geo SEO Seeding complete!');
}

seedSEO();
