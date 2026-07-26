import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.get('/', authenticate, getProfile);
router.put('/', authenticate, updateProfile);

export default router;
