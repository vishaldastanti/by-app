import dotenv from 'dotenv';
dotenv.config();
import { env } from './config/env';

const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;`;

async function run() {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  console.log(await response.text());
}
run();
