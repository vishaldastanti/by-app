import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, subscribePush, unsubscribePush, broadcast } from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.post('/subscribe', subscribePush);
router.post('/unsubscribe', unsubscribePush);
router.post('/broadcast', broadcast);

export default router;
