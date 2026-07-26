import { Router } from 'express';
import { getPendingRefunds, approveRefund, rejectRefund } from '../controllers/refund.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Only admin/superadmin can access these routes
router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

router.get('/', getPendingRefunds);
router.post('/:id/approve', approveRefund);
router.post('/:id/reject', rejectRefund);

export default router;
