import { Router } from 'express';
import { getSetting, updateSetting } from '../controllers/settings.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// Anyone can get settings (or maybe just authenticated)
router.get('/:key', getSetting);

// Only admins can update (authentication + role check is expected here or in controller)
router.put('/:key', authenticate, updateSetting);

export default router;
