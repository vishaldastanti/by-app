import { Router } from 'express';
import { 
  getGuides, 
  getGuideBySlug, 
  createGuide, 
  updateGuide, 
  deleteGuide,
  getMyGuides
} from '../controllers/guide.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createGuideSchema, updateGuideSchema } from '../schemas/guide.schema';

const router = Router();

// Public routes
router.get('/', getGuides);
router.get('/:slug', getGuideBySlug);

// Protected routes
router.use(authenticate);

router.get('/my/listings', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), getMyGuides);
router.post('/', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), validate(createGuideSchema), createGuide);
router.put('/:id', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), validate(updateGuideSchema), updateGuide);
router.delete('/:id', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), deleteGuide);

export default router;
