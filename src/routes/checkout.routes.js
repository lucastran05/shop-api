import { Router } from 'express';
import CheckoutController from '../controllers/checkout.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Yêu cầu xác thực người dùng
router.use(verifyAuth);

// CHK01: Tính phí vận chuyển và tạm tính tiền
router.post('/quote', CheckoutController.getQuote);

export default router;
