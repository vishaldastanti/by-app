require('dotenv').config();
const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL;

async function resetAndRun() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Dropping public schema...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;');
    console.log('Public schema reset successfully.');
  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    await client.end();
  }
}

resetAndRun();
