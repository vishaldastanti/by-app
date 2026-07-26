/**
 * Seed script to insert destinations into the Supabase database.
 * Run: node seed-destinations.js
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://edxczodmjnthfhdtrjlm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkeGN6b2Rtam50aGZoZHRyamxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE5ODMwNiwiZXhwIjoyMDg1Nzc0MzA2fQ.8DPZ1bc7QQgYOa9Udhp2ejt4s_d-MAtEQPS10boryHc';

const supabase = createClient(supabaseUrl, supabaseKey);

const destinations = [
  {
    name: 'Bodh Gaya',
    slug: 'bodh-gaya',
    tagline: 'Where the World Finds Peace',
    description: 'The spiritual epicenter of Buddhism. Sit beneath the shade of the descendant of the original Bodhi Tree, explore dozens of international monasteries, and find absolute tranquility away from the chaos of the city.',
    category: 'spiritual',
    location: 'Gaya District, Bihar',
    hero_image_url: 'https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800',
    highlights: ['Mahabodhi Temple', 'Bodhi Tree', 'Great Buddha Statue', 'Meditation Park', 'Archaeological Museum'],
    best_time: 'October — March',
    price: '₹1,500',
    rating: 4.9,
    review_count: 320,
    is_published: true,
    sections: [
      { header: 'History', content: 'Bodh Gaya is one of the four most sacred places for Buddhists. Prince Siddhartha Gautama attained enlightenment here around 528 BCE, becoming the Buddha. The Mahabodhi Temple complex was built by Emperor Ashoka in the 3rd century BCE.' },
      { header: 'What to See', content: 'The Mahabodhi Temple stands at 55 meters tall with its stunning pyramidal spire. The sacred Bodhi Tree, a direct descendant of the original tree, draws pilgrims from around the world. Don\'t miss the Great Buddha Statue, the Muchalinda Lake, and the numerous international monasteries.' }
    ],
    tags: ['UNESCO', 'Buddhist', 'Pilgrimage', 'Temple', 'Meditation']
  },
  {
    name: 'Nalanda',
    slug: 'nalanda',
    tagline: 'The Pinnacle of Ancient Knowledge',
    description: 'Wander through the sprawling, red-brick ruins of a university that attracted scholars from across the globe 1,500 years ago. Nalanda is a testament to India\'s golden age of mathematics, astronomy, and philosophy.',
    category: 'heritage',
    location: 'Nalanda, Bihar',
    hero_image_url: 'https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800',
    highlights: ['UNESCO World Heritage Ruins', 'Archaeological Museum', 'Nalanda Multimedia Museum', 'Ancient Monastery Remains', 'Xuanzang Memorial Hall'],
    best_time: 'October — March',
    price: '₹1,200',
    rating: 4.8,
    review_count: 215,
    is_published: true,
    sections: [
      { header: 'History', content: 'Founded in 427 CE during the Gupta dynasty, Nalanda University flourished for over 800 years as the greatest center of learning in Asia. Scholars like Xuanzang from China traveled thousands of miles to study here. The university was destroyed by Bakhtiyar Khilji\'s army in 1193 CE.' },
      { header: 'What to See', content: 'The excavated ruins spread across 14 hectares, revealing 11 monasteries and 6 temples arranged methodically. The Nalanda Archaeological Museum houses bronze statues, coins, and inscriptions. The modern Nalanda Multimedia Museum offers an immersive experience with 3D mapping and holographic displays.' }
    ],
    tags: ['UNESCO', 'University', 'Ancient', 'Archaeological', 'Museum']
  },
  {
    name: 'Rajgir',
    slug: 'rajgir',
    tagline: 'Valleys of Mysticism',
    description: 'Surrounded by seven lush hills, Rajgir was the first capital of the Magadh Empire. Soak in the natural hot springs, ride the ropeway to the Peace Pagoda, and explore the ancient Cyclopean Wall.',
    category: 'nature',
    location: 'Rajgir, Nalanda District, Bihar',
    hero_image_url: 'https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800',
    highlights: ['Glass Skywalk Bridge', 'Vishwa Shanti Stupa', 'Ropeway Ride', 'Hot Springs (Brahmakund)', 'Cyclopean Walls', 'Griddhakuta Peak'],
    best_time: 'October — March',
    price: '₹2,000',
    rating: 4.7,
    review_count: 180,
    is_published: true,
    sections: [
      { header: 'History', content: 'Rajgir served as the capital of the Magadha kingdom under King Bimbisara, who was a contemporary and patron of Lord Buddha. The city is mentioned in both Buddhist and Jain texts. The First Buddhist Council was held here after the Buddha\'s death.' },
      { header: 'What to See', content: 'Take the ropeway to Vishwa Shanti Stupa atop Ratnagiri Hill for panoramic views. Walk the glass skywalk bridge for a thrilling experience. Visit the natural hot springs at Brahmakund, believed to have medicinal properties. Explore Griddhakuta (Vulture\'s Peak), where Buddha delivered many of his sermons.' }
    ],
    tags: ['Glass Bridge', 'Ropeway', 'Hot Springs', 'Valley', 'Buddhist', 'Jain']
  },
  {
    name: 'Rohtasgarh',
    slug: 'rohtasgarh',
    tagline: 'The Grand Canyon of Bihar',
    description: 'Perched atop the Kaimur hills, surrounded by waterfalls and dense forests, lies one of the largest and most mysterious hill forts in India. A paradise for trekkers and history buffs looking for untouched beauty.',
    category: 'heritage',
    location: 'Rohtas, Bihar',
    hero_image_url: 'https://images.unsplash.com/photo-1591264247204-74d15024b420?q=80&w=800',
    highlights: ['Rohtasgarh Fort', 'Waterfalls', 'Kaimur Hills', 'Trekking', 'Ancient Temples'],
    best_time: 'October — March',
    price: '₹1,500',
    rating: 4.5,
    review_count: 120,
    is_published: true,
    sections: [
      { header: 'History', content: 'Rohtasgarh is considered one of the largest and strongest hill forts in India. It served as a safe haven for various rulers, including Sher Shah Suri, who captured it in 1539.' },
      { header: 'What to See', content: 'Explore the extensive ruins of the fort, the beautiful palace of Man Singh, and the numerous waterfalls in the surrounding Kaimur hills.' }
    ],
    tags: ['Fort', 'Trekking', 'Heritage', 'Hills', 'Nature']
  },
  {
    name: 'Valmiki Tiger Reserve',
    slug: 'valmiki-tiger-reserve',
    tagline: 'The Wild Frontier',
    description: 'Nestled against the Himalayan foothills on the Nepal border, Bihar\'s only national park is a thriving ecosystem of Bengal tigers, leopards, and diverse birdlife. The perfect escape into the wild.',
    category: 'nature',
    location: 'West Champaran, Bihar',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Valmiki_Nagar_Tiger_Reserve.jpg/800px-Valmiki_Nagar_Tiger_Reserve.jpg',
    highlights: ['Jungle Safari', 'Tiger Spotting', 'Eco-Hut Stay', 'Bird Watching', 'Gandak River Rafting', 'Nepal Border Crossing'],
    best_time: 'November — April',
    price: '₹3,500',
    rating: 4.6,
    review_count: 95,
    is_published: true,
    sections: [
      { header: 'Wildlife', content: 'The reserve is home to approximately 40 Royal Bengal Tigers, along with leopards, wild elephants, one-horned rhinoceros, sloth bears, and Indian bison. Over 250 species of birds have been recorded, including hornbills, eagles, and kingfishers.' },
      { header: 'Experience', content: 'Book a jeep safari through the core zone for the best chance of tiger sightings. Stay in the eco-huts run by the forest department for an authentic jungle experience. River rafting on the Gandak River offers a unique perspective of the forest. The reserve also borders Nepal\'s Chitwan National Park.' }
    ],
    tags: ['Tiger Reserve', 'Safari', 'Wildlife', 'National Park', 'Eco-Tourism']
  }
];

async function seed() {
  console.log('🌱 Upserting 5 destinations into Supabase...\n');

  for (const dest of destinations) {
    const { data, error } = await supabase
      .from('destinations')
      .upsert(
        { ...dest, slug: dest.slug }, 
        { onConflict: 'slug' }
      )
      .select('id, name, slug')
      .single();

    if (error) {
      console.error(`❌ Failed to upsert "${dest.name}":`, error.message);
    } else {
      console.log(`✅ Upserted "${data.name}" → /destinations/${data.slug} (id: ${data.id})`);
    }
  }

  console.log('\n🎉 Seeding complete!');
}

seed();
