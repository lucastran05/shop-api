import { Router } from 'express';
import pool from '../config/db.js';
import { verifyAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';
import { BadRequestError, NotFoundError } from '../common/errors/AppError.js';
import orderRepository from '../modules/storefront/order.repository.js';
import { voucherRepository } from '../modules/storefront/voucher.repository.js';
import { chatAnswer } from '../services/chatbot-answer.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = Router();
router.post('/message', rateLimiter({ windowMs: 60000, max: 12 }), optionalAuth, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'success', data: await chatAnswer(req.body, req.user?.id) });
}));
router.get('/promotions', optionalAuth, asyncHandler(async (req, res) => {
  const data = await voucherRepository.listAvailable({ userId: req.user?.id });
  res.json({ status: 'success', data });
}));
router.get('/orders/:code', verifyAuth, asyncHandler(async (req, res) => {
  const code = req.params.code.trim();
  if (!code || code.length > 100) throw new BadRequestError('Mã đơn hàng không hợp lệ');
  const { rows } = await pool.query(
    'SELECT id FROM orders WHERE user_id = $1 AND UPPER(code) = UPPER($2) LIMIT 1',
    [req.user.id, code],
  );
  if (!rows.length) throw new NotFoundError('Không tìm thấy đơn hàng trong tài khoản của bạn');
  const data = await orderRepository.getUserOrderDetail(req.user.id, rows[0].id);
  res.json({ status: 'success', data });
}));
export default router;
