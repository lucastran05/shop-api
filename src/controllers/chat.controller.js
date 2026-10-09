import ChatService from '../services/chat.service.js';

class ChatController {
  // GET /api/v1/chat/conversations (Chỉ Admin / Manager)
  static async getConversations(req, res, next) {
    try {
      const conversations = await ChatService.getConversations();

      return res.status(200).json({
        status: 'success',
        data: { conversations },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/chat/messages
  static async getMessages(req, res, next) {
    try {
      const { owner, conversation_id, page, limit, unread_only } = req.query;

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      // Khách hàng thông thường chỉ được xem tin nhắn của chính họ
      const targetOwner = isStaff ? owner : req.user?.email;

      const result = await ChatService.getMessages({
        owner: targetOwner,
        conversation_id,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        unread_only,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/chat/messages/:id
  static async getMessageById(req, res, next) {
    try {
      const { id } = req.params;
      const message = await ChatService.getMessageById(id);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isOwner = message.owner === req.user?.email || message.sender_id === req.user?.id;

      if (!isStaff && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền xem tin nhắn này',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/chat/messages
  static async sendMessage(req, res, next) {
    try {
      const isStaff = ['admin', 'manager'].includes(req.user?.role);

      const payload = {
        ...req.body,
        sender_id: req.user?.id,
        sender_name: req.user?.name || req.body.sender_name,
        sender_role: isStaff ? (req.body.sender_role || 'shop') : 'customer',
        // Nếu không phải nhân viên, chủ cuộc hội thoại luôn là email của chính khách hàng đó
        owner: isStaff ? (req.body.owner || req.user?.email) : req.user?.email,
      };

      const message = await ChatService.sendMessage(payload);

      return res.status(201).json({
        status: 'success',
        message: 'Gửi tin nhắn thành công',
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/chat/messages/:id/read
  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await ChatService.getMessageById(id);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isOwner = existing.owner === req.user?.email || existing.sender_id === req.user?.id;

      if (!isStaff && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền cập nhật tin nhắn này',
        });
      }

      const message = await ChatService.markAsRead(id);

      return res.status(200).json({
        status: 'success',
        message: 'Đã đánh dấu tin nhắn là đã đọc',
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/chat/read-all
  static async markAllAsRead(req, res, next) {
    try {
      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const targetOwner = isStaff ? (req.body.owner || req.query.owner || req.user?.email) : req.user?.email;

      const result = await ChatService.markAllAsRead(targetOwner);

      return res.status(200).json({
        status: 'success',
        message: `Đã đánh dấu ${result.updatedCount} tin nhắn là đã đọc`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/chat/messages/:id
  static async deleteMessage(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await ChatService.getMessageById(id);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isSender = existing.sender_id === req.user?.id;

      if (!isStaff && !isSender) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền xóa tin nhắn này',
        });
      }

      await ChatService.deleteMessage(id);

      return res.status(200).json({
        status: 'success',
        message: 'Xóa tin nhắn thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/chat/conversations/:owner
  static async deleteConversation(req, res, next) {
    try {
      const { owner } = req.params;
      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isOwner = req.user?.email === owner;

      if (!isStaff && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền xóa hội thoại này',
        });
      }

      const result = await ChatService.deleteConversation(owner);

      return res.status(200).json({
        status: 'success',
        message: `Đã xóa hội thoại với ${result.deletedCount} tin nhắn`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default ChatController;
