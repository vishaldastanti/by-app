require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Ensure you are using the URL from your .env file!
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL is not set in your .env file!");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`✅ Connected to database: ${connectionString.split('@')[1].split('/')[1]}`);
    
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
                    .filter(f => f.endsWith('.sql'))
                    .sort(); // Sort alphabetically (001, 002, etc.)

    console.log(`Found ${files.length} migration files. Applying them in order...`);

    for (const file of files) {
      console.log(`⏳ Running ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`✅ ${file} applied successfully.`);
    }
    
    console.log('🎉 All migrations applied successfully!');
  } catch (err) {
    console.error('❌ Error applying migration:', err);
  } finally {
    await client.end();
  }
}

run();
