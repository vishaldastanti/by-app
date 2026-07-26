import { Request, Response } from 'express';
import { getSupabaseClient, adminSupabase } from '../config/supabase';

// GET /api/v1/availability/:service_type/:service_id?month=YYYY-MM
export const getAvailability = async (req: Request, res: Response) => {
  const supabase = getSupabaseClient(req);
  try {
    const { service_type, service_id } = req.params;
    const { month } = req.query;

    if (!service_type || !service_id) {
      return res.status(400).json({ error: 'service_type and service_id are required' });
    }

    // Calculate date range for the month (or default to current month)
    let startDate: string;
    let endDate: string;
    if (month && typeof month === 'string') {
      startDate = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    // Fetch booked dates (confirmed/in_progress bookings within the date range)
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, check_in, check_out, guests, status, booked_rooms')
      .eq('service_id', service_id)
      .in('status', ['confirmed', 'in_progress'])
      .gte('check_in', startDate)
      .lte('check_in', endDate);

    if (bookingsError) throw bookingsError;

    // Fetch total rooms
    let totalRooms = 1;
    if (service_type === 'homestay') {
      const { data: hs } = await adminSupabase.from('homestays').select('number_of_rooms').eq('id', service_id).single();
      if (hs && hs.number_of_rooms) totalRooms = hs.number_of_rooms;
    }

    // Expand booked date ranges into individual dates
    const bookedDates: string[] = [];
    const bookedInfoMap: Record<string, number> = {};

    for (const booking of bookings || []) {
      if (!booking.check_in) continue;
      const checkIn = new Date(booking.check_in);
      const checkOut = booking.check_out ? new Date(booking.check_out) : new Date(checkIn.getTime() + 86400000);
      const rooms = booking.booked_rooms || 1;
      
      for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        bookedDates.push(dateStr);
        bookedInfoMap[dateStr] = (bookedInfoMap[dateStr] || 0) + rooms;
      }
    }

    // Fetch manually blocked dates
    const { data: blockedDatesData, error: blockedError } = await supabase
      .from('provider_blocked_dates')
      .select('blocked_date')
      .eq('service_id', service_id)
      .gte('blocked_date', startDate)
      .lte('blocked_date', endDate);

    if (blockedError) throw blockedError;

    const blockedDates = (blockedDatesData || []).map(b => b.blocked_date);

    const booked_dates_info = Object.entries(bookedInfoMap).map(([date, booked_rooms]) => ({
      date,
      booked_rooms,
      total_rooms: totalRooms,
      rooms_left: Math.max(0, totalRooms - booked_rooms)
    }));

    return res.status(200).json({
      booked_dates: bookedDates,
      blocked_dates: blockedDates,
      booked_dates_info: booked_dates_info,
      total_rooms: totalRooms
    });
  } catch (error: any) {
    console.error('Availability fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
