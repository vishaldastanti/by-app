import { Router } from 'express';
import { 
  getTransports, 
  getTransportById, 
  createTransport, 
  updateTransport, 
  deleteTransport,
  getMyTransports
} from '../controllers/transport.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createTransportSchema, updateTransportSchema } from '../schemas/transport.schema';

const router = Router();

// Public routes
router.get('/', getTransports);
router.get('/:id', getTransportById);

// Protected routes
router.use(authenticate);

router.get('/my/listings', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), getMyTransports);
router.post('/', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), validate(createTransportSchema), createTransport);
router.put('/:id', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), validate(updateTransportSchema), updateTransport);
router.delete('/:id', authorize('provider', 'admin', 'superadmin', 'content_manager', 'approval_manager'), deleteTransport);

export default router;
