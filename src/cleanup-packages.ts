import { supabase } from './config/supabase';

async function cleanup() {
  console.log("Cleaning up old bad packages...");
  const badIds = [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
    "00000000-0000-0000-0000-000000000004",
    "00000000-0000-0000-0000-000000000005"
  ];
  const { data, error } = await supabase.from('packages').delete().in('id', badIds);
  if (error) {
    console.error("Failed to delete old packages:", error.message);
  } else {
    console.log("Deleted old packages.");
  }
}
cleanup();
