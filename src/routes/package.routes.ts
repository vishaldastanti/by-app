import { Router } from 'express';
import { 
  getPackages, 
  getTrendingPackages,
  getPackageBySlug, 
  getPackageById,
  createPackage, 
  updatePackage, 
  deletePackage 
} from '../controllers/package.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createPackageSchema, updatePackageSchema } from '../schemas/package.schema';

const router = Router();

// Public routes
router.get('/', getPackages);
router.get('/trending', getTrendingPackages);
router.get('/id/:id', getPackageById);
router.get('/:slug', getPackageBySlug);

// Admin-only protected routes
router.use(authenticate);
router.use(authorize('admin', 'superadmin', 'content_manager'));

router.post('/', validate(createPackageSchema), createPackage);
router.put('/:id', validate(updatePackageSchema), updatePackage);
router.delete('/:id', deletePackage);

export default router;
