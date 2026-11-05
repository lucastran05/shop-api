import communicationRepository from '../modules/communication/communication.repository.js';
import { BadRequestError, NotFoundError } from '../common/errors/AppError.js';

class ChatService {
  // Lấy danh sách hội thoại
  static async getConversations() {
    return await communicationRepository.getConversations();
  }

  // Lấy tin nhắn theo bộ lọc
  static async getMessages(filters) {
    return await communicationRepository.findMessages(filters);
  }

  // Lấy chi tiết tin nhắn theo ID
  static async getMessageById(id) {
    const msg = await communicationRepository.findById(id);
    if (!msg) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }
    return msg;
  }

  // Gửi tin nhắn mới
  static async sendMessage(data) {
    const content = data.message || data.text;
    const { owner } = data;

    if (!owner || !owner.trim()) {
      throw new BadRequestError('Người nhận / chủ hội thoại (owner) không được để trống');
    }

    if (!content || !content.trim()) {
      throw new BadRequestError('Nội dung tin nhắn không được để trống');
    }

    const senderRole = data.sender_role || data.from || 'customer';

    return await communicationRepository.create({
      owner: owner.trim(),
      message: content.trim(),
      conversation_id: data.conversation_id || data.conversationId,
      sender_id: data.sender_id || data.senderId,
      sender_name: data.sender_name || data.senderName,
      sender_role: senderRole,
    });
  }

  // Đánh dấu tin nhắn đã đọc
  static async markAsRead(id) {
    const existing = await communicationRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    return await communicationRepository.markAsRead(id);
  }

  // Đánh dấu tất cả tin nhắn đã đọc
  static async markAllAsRead(owner) {
    if (!owner || !owner.trim()) {
      throw new BadRequestError('Vui lòng cung cấp thông tin owner');
    }

    const updatedCount = await communicationRepository.markAllAsRead(owner.trim());
    return { updatedCount };
  }

  // Xóa tin nhắn
  static async deleteMessage(id) {
    const existing = await communicationRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Không tìm thấy tin nhắn để xóa');
    }

    return await communicationRepository.delete(id);
  }

  // Xóa toàn bộ hội thoại
  static async deleteConversation(owner) {
    if (!owner || !owner.trim()) {
      throw new BadRequestError('Vui lòng cung cấp thông tin owner');
    }

    const deletedCount = await communicationRepository.deleteConversation(owner.trim());
    return { deletedCount };
  }
}

export default ChatService;
