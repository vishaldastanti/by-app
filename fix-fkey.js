require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function fixForeignKey() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Fixing foreign key issue...');
    await client.query(`
      ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
      NOTIFY pgrst, 'reload schema';
    `);
    console.log('✅ Foreign key dropped. Registration should now work!');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

fixForeignKey();
