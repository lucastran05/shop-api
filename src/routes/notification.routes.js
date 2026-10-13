import { Router } from 'express';
import NotificationController from '../controllers/notification.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Toàn bộ chức năng thông báo yêu cầu người dùng đăng nhập
router.use(verifyAuth);

// NOT03: Đánh dấu tất cả thông báo là đã đọc (hỗ trợ cả POST /read-all và PATCH /mark-all-read)
router.post('/read-all', NotificationController.markAllAsRead);
router.patch('/mark-all-read', NotificationController.markAllAsRead);

// Xóa tất cả các thông báo đã đọc (phải đặt trước /:id)
router.delete('/clear-read', NotificationController.clearRead);

// NOT02: Đánh dấu 1 thông báo là đã đọc theo hợp đồng /:notification_id/read
router.patch('/:notification_id/read', NotificationController.markAsRead);

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
