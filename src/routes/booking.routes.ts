import { Router } from 'express';
import { 
  createBooking, 
  getMyBookings, 
  getBookingById, 
  cancelBooking, 
  getAllBookings,
  updateBookingStatus,
  getProviderBookings,
  confirmLocationBooking,
  allotRooms
} from '../controllers/booking.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createBookingSchema, updateBookingStatusSchema } from '../schemas/booking.schema';

const router = Router();

// ALL booking routes require authentication
router.use(authenticate);

// User endpoints
router.post('/', validate(createBookingSchema), createBooking);
router.get('/my', getMyBookings);

// Provider endpoint (must be before /:id to avoid route conflict)
router.get('/provider', authorize('provider', 'admin', 'superadmin'), getProviderBookings);

router.get('/:id', getBookingById);
router.post('/:id/confirm-location', confirmLocationBooking);
router.patch('/:id/cancel', cancelBooking);

// Admin and Provider endpoints
router.get('/', authorize('admin', 'superadmin', 'content_manager', 'approval_manager'), getAllBookings);
router.patch('/:id/status', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), validate(updateBookingStatusSchema), updateBookingStatus);
router.patch('/:id/allot-rooms', authorize('provider', 'admin', 'superadmin'), allotRooms);

export default router;
