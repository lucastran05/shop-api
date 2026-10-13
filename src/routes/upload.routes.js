import { Router } from 'express';
import ProductController from '../controllers/product.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// REV03 / ADP07: Upload file ảnh (yêu cầu đăng nhập)
router.post('/', verifyAuth, ProductController.upload);

export default router;
