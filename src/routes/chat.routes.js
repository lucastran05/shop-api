import { Router } from 'express';
import ChatController from '../controllers/chat.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Toàn bộ chức năng chat cần xác thực danh tính
router.use(verifyAuth);

// Lấy danh sách các cuộc hội thoại (Chỉ nhân viên quản lý/admin mới có quyền xem tổng quan hội thoại)
router.get('/conversations', requireRole('admin', 'manager'), ChatController.getConversations);

// Lấy danh sách tin nhắn (khách hàng chỉ xem tin nhắn của chính mình, admin xem được toàn bộ)
router.get('/messages', ChatController.getMessages);

// Lấy chi tiết một tin nhắn
router.get('/messages/:id', ChatController.getMessageById);

// Gửi tin nhắn mới (người dùng gửi tin nhắn trong phiên của mình)
router.post('/messages', ChatController.sendMessage);

// Đánh dấu một tin nhắn là đã đọc
router.patch('/messages/:id/read', ChatController.markAsRead);

// Đánh dấu tất cả tin nhắn là đã đọc
router.patch('/read-all', ChatController.markAllAsRead);

// Xóa một tin nhắn (chỉ người gửi hoặc admin)
router.delete('/messages/:id', ChatController.deleteMessage);

// Xóa cuộc hội thoại theo owner (chính chủ hoặc admin)
router.delete('/conversations/:owner', ChatController.deleteConversation);

export default router;
