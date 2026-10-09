import { Router } from 'express';
import PaymentController from '../controllers/payment.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Tất cả các route thanh toán đều yêu cầu xác thực người dùng
router.use(verifyAuth);

// Lấy danh sách thanh toán theo orderId (chỉ chủ đơn hàng hoặc Admin/Manager)
router.get('/order/:orderId', PaymentController.getByOrderId);

// Lấy danh sách thanh toán (Admin xem tất cả; Người dùng thường chỉ xem lịch sử của chính mình)
router.get('/', PaymentController.getAll);

// Lấy chi tiết thanh toán theo ID (chủ thanh toán hoặc Admin/Manager)
router.get('/:id', PaymentController.getById);

// Tạo mới bản ghi thanh toán (gán chặt với user_id của tài khoản đang đăng nhập)
router.post('/', PaymentController.create);

// Cập nhật thông tin thanh toán (chỉ Admin và Manager)
router.put('/:id', requireRole('admin', 'manager'), PaymentController.update);

// Cập nhật trạng thái thanh toán (chỉ Admin và Manager)
router.patch('/:id/status', requireRole('admin', 'manager'), PaymentController.updateStatus);

// Xóa bản ghi thanh toán (chỉ Admin)
router.delete('/:id', requireRole('admin'), PaymentController.delete);

export default router;
