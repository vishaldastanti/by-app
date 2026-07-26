import { Router } from 'express';
import { register, login, refresh, logout, getMe, updateMe, getAllUsers, adminCreateUser, updateUserRole, adminDeleteUser, getAdminStats, sendEmailOtp, verifyEmailOtp, forgotPassword, resetPassword, googleLogin, verifyProvider, adminApproveProvider, adminGetUserById } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/send-email-otp', sendEmailOtp);
router.post('/verify-email-otp', verifyEmailOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.post('/provider-verify', authenticate, authorize('provider'), verifyProvider);

// Admin routes
router.get('/users', authenticate, authorize('admin', 'superadmin'), getAllUsers);
router.get('/admin/stats', authenticate, authorize('admin', 'superadmin', 'content_manager', 'approval_manager'), getAdminStats);
router.post('/admin/create', authenticate, authorize('superadmin'), adminCreateUser);
router.patch('/users/:id/role', authenticate, authorize('superadmin'), updateUserRole);
router.get('/users/:id', authenticate, authorize('superadmin'), adminGetUserById);
router.delete('/users/:id', authenticate, authorize('superadmin'), adminDeleteUser);
router.patch('/admin/providers/:id/approve', authenticate, authorize('superadmin', 'admin', 'approval_manager'), adminApproveProvider);

export default router;
