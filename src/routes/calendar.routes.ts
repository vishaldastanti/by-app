import { Router } from 'express';
import { getProviderCalendar, blockDates, unblockDates } from '../controllers/calendar.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// All calendar routes require authentication + provider role
router.use(authenticate);
router.use(authorize('provider', 'admin', 'superadmin'));

router.get('/', getProviderCalendar);
router.post('/block', blockDates);
router.delete('/unblock', unblockDates);

export default router;
