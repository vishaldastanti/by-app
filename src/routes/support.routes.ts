import { Router } from 'express';
import { createTicket, getUserTickets, getAllTickets, updateTicketStatus, getTicketById, getTicketMessages, addTicketMessage } from '../controllers/support.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// User routes
router.post('/', authenticate, createTicket);
router.get('/my', authenticate, getUserTickets);

// Admin routes
router.get('/', authenticate, authorize('admin', 'superadmin'), getAllTickets);
router.put('/:id/status', authenticate, authorize('admin', 'superadmin'), updateTicketStatus);

// Chat & Details routes (accessible by both ticket owner and admin)
router.get('/:id', authenticate, getTicketById);
router.get('/:id/messages', authenticate, getTicketMessages);
router.post('/:id/messages', authenticate, addTicketMessage);

export default router;
