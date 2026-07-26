const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const token = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000000', role: 'admin' }, 
  process.env.JWT_ACCESS_SECRET
);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  global: {
    headers: { Authorization: `Bearer ${token}` }
  }
});

async function test() {
  console.log("Testing authenticated destinations query...");
  const { data, error } = await supabase
    .from('destinations')
    .select('id, name')
    .eq('is_published', true);

  if (error) {
    console.error("SUPABASE ERROR DETAILS:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS! Got destinations:", data.length);
  }
}

test();
