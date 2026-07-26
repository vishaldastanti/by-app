import { Router } from 'express';
import { getPendingProviders, getFinancialStats, getAllBookings, getAdminBookingById, getAllHomestays, getAllPackages, updateListingStatus, deleteReview, getAllReviews, markPayoutsPaid } from '../controllers/admin.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Protect all routes with admin/superadmin roles
router.use(authenticate);

router.get('/pending-providers', authorize('superadmin', 'admin', 'approval_manager'), getPendingProviders);
router.get('/financial-stats', authorize('superadmin', 'admin'), getFinancialStats);
router.post('/payouts/mark-paid', authorize('superadmin', 'admin'), markPayoutsPaid);

// Phase 2: Live Operations & Governance
router.get('/bookings', authorize('superadmin', 'admin', 'approval_manager'), getAllBookings);
router.get('/bookings/:id', authorize('superadmin', 'admin', 'approval_manager'), getAdminBookingById);
router.get('/homestays', authorize('superadmin', 'admin', 'content_manager', 'approval_manager'), getAllHomestays);
router.get('/packages', authorize('superadmin', 'admin', 'content_manager', 'approval_manager'), getAllPackages);
router.patch('/listings/:type/:id/status', authorize('superadmin', 'admin', 'content_manager'), updateListingStatus);
router.get('/reviews', authorize('superadmin', 'admin', 'content_manager'), getAllReviews);
router.delete('/reviews/:id', authorize('superadmin', 'admin', 'content_manager'), deleteReview);

export default router;
