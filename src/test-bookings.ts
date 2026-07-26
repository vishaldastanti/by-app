import { supabase } from './config/supabase';
import dotenv from 'dotenv';
dotenv.config();

async function testFetch() {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error("Supabase Error:", error);
    } else {
      console.log("Success:", data);
    }
  } catch(e) {
    console.error("Exception:", e);
  }
}
testFetch();
