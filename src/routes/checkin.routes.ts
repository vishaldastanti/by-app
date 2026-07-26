import { Router } from 'express';
import {
  getCheckinToken,
  scanQrCode,
  confirmCheckin,
  confirmCashPayment,
  confirmCheckout
} from '../controllers/checkin.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Require auth for all routes
router.use(authenticate);

// User fetches their own token
router.get('/token/:bookingId', getCheckinToken);

// Provider endpoints
router.post('/scan', authorize('provider', 'admin', 'superadmin'), scanQrCode);
router.post('/cash-payment', authorize('provider', 'admin', 'superadmin'), confirmCashPayment);
router.post('/confirm', authorize('provider', 'admin', 'superadmin'), confirmCheckin);
router.post('/checkout', authorize('provider', 'admin', 'superadmin'), confirmCheckout);

export default router;
