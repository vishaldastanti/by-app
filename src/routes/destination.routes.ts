import { Router } from 'express';
import { 
  getDestinations, 
  getDestinationBySlug, 
  createDestination, 
  updateDestination, 
  deleteDestination, 
  searchDestinations 
} from '../controllers/destination.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createDestinationSchema, updateDestinationSchema } from '../schemas/destination.schema';

const router = Router();

// Public routes
router.get('/', getDestinations);
router.get('/search', searchDestinations);
router.get('/:slug', getDestinationBySlug);

// Admin-only protected routes
router.use(authenticate);
router.use(authorize('admin', 'superadmin', 'content_manager'));

router.post('/', validate(createDestinationSchema), createDestination);
router.put('/:id', validate(updateDestinationSchema), updateDestination);
router.delete('/:id', deleteDestination);

export default router;
