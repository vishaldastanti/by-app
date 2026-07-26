import { Router } from 'express';
import { 
  getHomestays, 
  getHomestayBySlug, 
  createHomestay, 
  updateHomestay, 
  deleteHomestay,
  toggleAvailability,
  getMyHomestays
} from '../controllers/homestay.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createHomestaySchema, updateHomestaySchema } from '../schemas/homestay.schema';

const router = Router();

router.get('/my/listings', authenticate, authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), getMyHomestays);

// Public routes
router.get('/', getHomestays);
router.get('/:slug', getHomestayBySlug);

// Protected routes (Providers & Admins)
router.use(authenticate);

router.post('/', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), validate(createHomestaySchema), createHomestay);
router.put('/:id', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), validate(updateHomestaySchema), updateHomestay);
router.delete('/:id', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), deleteHomestay);
router.patch('/:id/availability', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), toggleAvailability);

export default router;
