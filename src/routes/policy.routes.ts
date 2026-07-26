import { Router } from 'express';
import { proposePolicy, getPendingPolicies, approvePolicy, rejectPolicy } from '../controllers/policy.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// Provider Route
router.post('/propose', authorize('provider', 'homestay_owner', 'tour_guide', 'transport_provider'), proposePolicy);

// Admin Routes
router.get('/pending', authorize('admin', 'superadmin', 'approval_manager'), getPendingPolicies);
router.post('/:id/approve', authorize('admin', 'superadmin', 'approval_manager'), approvePolicy);
router.post('/:id/reject', authorize('admin', 'superadmin', 'approval_manager'), rejectPolicy);

export default router;
