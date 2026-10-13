import { Router } from 'express';
import PaymentController from '../controllers/payment.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// SYS01: Webhook thanh toán từ cổng thanh toán đối tác (công khai, không yêu cầu Bearer token)
router.post('/webhooks/:provider', PaymentController.webhook);

// PAY02: Theo dõi trạng thái phiên thanh toán (hoặc bản ghi thanh toán)
router.get('/:id', verifyAuth, PaymentController.getSession);

// Lấy danh sách thanh toán theo orderId (chỉ chủ đơn hàng hoặc Admin/Manager)
router.get('/order/:orderId', verifyAuth, PaymentController.getByOrderId);

// Lấy danh sách thanh toán (Admin xem tất cả; Người dùng thường chỉ xem lịch sử của chính mình)
router.get('/', verifyAuth, PaymentController.getAll);

// Tạo mới bản ghi thanh toán (gán chặt với user_id của tài khoản đang đăng nhập)
router.post('/', verifyAuth, PaymentController.create);

// Cập nhật thông tin thanh toán (chỉ Admin và Manager)
router.put('/:id', verifyAuth, requireRole('admin', 'manager'), PaymentController.update);

// Cập nhật trạng thái thanh toán (chỉ Admin và Manager)
router.patch('/:id/status', verifyAuth, requireRole('admin', 'manager'), PaymentController.updateStatus);

// Xóa bản ghi thanh toán (chỉ Admin)
router.delete('/:id', verifyAuth, requireRole('admin'), PaymentController.delete);

export default router;
