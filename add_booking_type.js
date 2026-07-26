const dotenv = require('dotenv');
dotenv.config();

async function runSQL(sql, label) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`✗ ${label}: ${text}`);
    return false;
  }
  console.log(`✓ ${label}`);
  return true;
}

runSQL(`ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS booking_type VARCHAR(50) DEFAULT 'enquiry';`, 'Add booking_type to packages');
