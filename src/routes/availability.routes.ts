import { Router } from 'express';
import { getAvailability } from '../controllers/availability.controller';

const router = Router();

// Public endpoint to check availability
router.get('/:service_type/:service_id', getAvailability);

export default router;
