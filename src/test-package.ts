import { adminSupabase } from './config/supabase';

async function test() {
  const { data, error } = await adminSupabase
    .from('packages')
    .update({ pickup_address: 'Test Airport Address', boarding_point: 'Test Station' })
    .eq('id', 'c3d4e5f6-3456-6789-abcd-ef0123456789')
    .select()
    .single();

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Update Success:', data);
  }
}
test();
