const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/017_create_contact_messages.sql', 'utf8');
  await client.query(sql);
  console.log('Successfully ran 017_create_contact_messages.sql');
  await client.query("NOTIFY pgrst, 'reload schema'");
  await client.end();
}
run().catch(console.error);
