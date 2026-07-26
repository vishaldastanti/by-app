import { Router } from 'express';
import { getProviderEarnings, requestPayout } from '../controllers/earnings.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// All earnings routes require authentication + provider role
router.use(authenticate);
router.use(authorize('provider', 'admin', 'superadmin'));

router.get('/', getProviderEarnings);
router.post('/request', requestPayout);

export default router;
