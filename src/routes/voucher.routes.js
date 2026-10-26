import { Router } from 'express';
import VoucherController from '../controllers/voucher.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(verifyAuth);
router.get('/available', VoucherController.available);
router.post('/validate', VoucherController.validate);

export default router;
