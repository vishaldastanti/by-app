import { Router } from 'express';
import { createOrder, webhook, verifyPayment } from '../controllers/payment.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { createOrderSchema } from '../schemas/payment.schema';

const router = Router();

// Create order needs authentication
router.post('/create-order', authenticate, validate(createOrderSchema), createOrder);

// Verify payment needs authentication
router.post('/verify', authenticate, verifyPayment);

// Webhook is called by Razorpay servers directly
router.post('/webhook', webhook);

export default router;
