import { Router } from 'express';
import ChatController from '../controllers/chat.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Yêu cầu xác thực người dùng
router.use(verifyAuth);

// CHAT01: Khách mở hoặc tạo hội thoại
router.post('/', ChatController.openCustomerConversation);

// CHAT02: Khách lấy danh sách tin nhắn hội thoại
router.get('/:conversation_id/messages', ChatController.getCustomerMessages);

// CHAT03: Khách gửi tin nhắn trong hội thoại
router.post('/:conversation_id/messages', ChatController.sendCustomerMessage);

export default router;
