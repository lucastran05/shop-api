import { Router } from 'express';
import OrderController from '../controllers/order.controller.js';
import CheckoutController from '../controllers/checkout.controller.js';
import PaymentController from '../controllers/payment.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Yêu cầu xác thực tài khoản
router.use(verifyAuth);

// CHK02: Đặt đơn hàng
router.post('/', CheckoutController.createOrder);

// ORD01: Lịch sử đơn hàng của tôi
router.get('/', OrderController.getUserOrders);

// PAY01: Tạo phiên thanh toán cho đơn hàng (đặt trước /:order_id)
router.post('/:order_id/payment-sessions', PaymentController.createSession);

// ORD03: Khách hủy đơn hàng
router.post('/:order_id/cancel', OrderController.cancelOrder);

// ORD02: Xem chi tiết đơn hàng
router.get('/:order_id', OrderController.getUserOrderDetail);

export default router;
