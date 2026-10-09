import { Router } from 'express';
import NotificationController from '../controllers/notification.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Toàn bộ chức năng thông báo yêu cầu người dùng đăng nhập
router.use(verifyAuth);

// Đánh dấu tất cả thông báo là đã đọc (phải đặt trước /:id)
router.patch('/mark-all-read', NotificationController.markAllAsRead);

// Xóa tất cả các thông báo đã đọc (phải đặt trước /:id)
router.delete('/clear-read', NotificationController.clearRead);

// Lấy danh sách thông báo (người dùng thường chỉ thấy thông báo của mình, admin có thể xem tất cả)
router.get('/', NotificationController.getAll);

// Lấy chi tiết thông báo theo ID (chủ thông báo hoặc Admin/Manager)
router.get('/:id', NotificationController.getById);

// Tạo thông báo mới (Chỉ Admin và Quản lý mới có quyền phát thông báo)
router.post('/', requireRole('admin', 'manager'), NotificationController.create);

// Đánh dấu một thông báo là đã đọc
router.patch('/:id/read', NotificationController.markAsRead);

// Xóa thông báo theo ID
router.delete('/:id', NotificationController.delete);

export default router;
