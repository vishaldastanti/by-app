import cron from 'node-cron';
import { adminSupabase } from '../config/supabase';
import { sendAutoCancellationEmail } from './email.service';

/**
 * Initializes and starts all scheduled background jobs.
 * This should be called once when the server starts.
 */
export const initCronJobs = () => {
  console.log('🕒 Initializing background cron jobs...');

  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running auto-cancellation job for unpaid advance bookings...');
    try {
      // 1. Fetch all unpaid bookings that are either pending or confirmed
      const { data: bookings, error } = await adminSupabase
        .from('bookings')
        .select('*, users(email, name)')
        .in('status', ['pending', 'confirmed'])
        .eq('payment_status', 'unpaid')
        .not('check_in', 'is', null);

      if (error) {
        console.error('❌ Failed to fetch unpaid bookings for cron:', error);
        return;
      }

      if (!bookings || bookings.length === 0) {
        return; // Nothing to process
      }

      const now = new Date();

      for (const booking of bookings) {
        let checkinTimeStr = '12:00:00'; // Default to noon

        // If it's a homestay, try to get the exact check-in time
        if (booking.service_type === 'homestay') {
          const { data: homestay } = await adminSupabase
            .from('homestays')
            .select('checkin_time')
            .eq('id', booking.service_id)
            .single();
          
          if (homestay && homestay.checkin_time) {
            checkinTimeStr = homestay.checkin_time;
          }
        }

        // Parse check-in date and time into a precise Date object
        const [hours, minutes] = checkinTimeStr.split(':').map(Number);
        const checkInDate = new Date(booking.check_in);
        checkInDate.setHours(hours, minutes, 0, 0);

        // Calculate the deadline (24 hours before check-in)
        const deadline = new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000);

        // If current time has passed the deadline, cancel the booking
        if (now >= deadline) {
          console.log(`❌ Cancelling booking ${booking.id} due to non-payment of advance.`);
          
          const { error: updateError } = await adminSupabase
            .from('bookings')
            .update({ 
              status: 'cancelled',
              notes: (booking.notes ? booking.notes + '\n' : '') + `Auto-cancelled on ${now.toISOString()} because 20% advance was not paid within 24 hours of check-in.`
            })
            .eq('id', booking.id);

          if (updateError) {
            console.error(`❌ Failed to update booking ${booking.id}:`, updateError);
            continue;
          }

          // Send cancellation email to user
          if (booking.users && booking.users.email) {
            try {
              await sendAutoCancellationEmail(booking.users.email, booking.users.name, booking);
            } catch (emailErr) {
              console.error(`❌ Failed to send cancellation email for booking ${booking.id}:`, emailErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('❌ Error in auto-cancellation cron job:', err);
    }
  });

  console.log('✅ Cron jobs initialized.');
};
