const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  console.log("Testing destinations query...");
  const { data, error } = await supabase
    .from('destinations')
    .select('id, name, slug, tagline, description, price, rating, review_count, category, location, hero_image_url, is_published, sections, highlights')
    .eq('is_published', true);

  if (error) {
    console.error("SUPABASE ERROR DETAILS:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS! Got destinations:", data.length);
  }
}

test();
