import express from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  getFinancialOverview,
  getAllTransactions,
  getPayouts,
  processPayout
} from '../controllers/finance.controller';

const router = express.Router();

// All finance routes require authentication (controller checks for admin role)
router.use(authenticate);

router.get('/overview', getFinancialOverview);
router.get('/transactions', getAllTransactions);
router.get('/payouts', getPayouts);
router.put('/payouts/:id/mark-paid', processPayout);

export default router;
