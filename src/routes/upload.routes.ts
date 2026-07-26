import { Router } from 'express';
import { uploadImage } from '../controllers/upload.controller';
import { upload } from '../config/cloudinary';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// ── HIGH-5 FIX: Require authentication for image uploads ──
router.post('/image', authenticate, upload.single('image'), uploadImage);

export default router;
