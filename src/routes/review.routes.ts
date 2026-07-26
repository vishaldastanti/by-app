import { Router } from 'express';
import { getPendingReviews, getPastReviews, submitReview, getProviderReviews, respondToReview, getServiceReviews } from '../controllers/review.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Public routes
router.get('/:serviceType/:serviceId', getServiceReviews);

// User routes
router.get('/pending', authenticate, getPendingReviews);
router.get('/past', authenticate, getPastReviews);
router.post('/', authenticate, submitReview);

// Provider routes
router.get('/provider', authenticate, authorize('provider', 'admin', 'superadmin'), getProviderReviews);
router.post('/:id/respond', authenticate, authorize('provider', 'admin', 'superadmin'), respondToReview);

export default router;
