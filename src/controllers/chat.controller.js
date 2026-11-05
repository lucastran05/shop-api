import ChatService from '../services/chat.service.js';
import CommunicationPolicy from '../modules/communication/communication.policy.js';
import communicationRepository from '../modules/communication/communication.repository.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class ChatController {
  // GET /api/v1/chat/conversations (Chỉ Admin / Manager)
  static getConversations = asyncHandler(async (req, res) => {
    const conversations = await ChatService.getConversations();

    return res.status(200).json({
      status: 'success',
      data: { conversations },
    });
  });

  // GET /api/v1/chat/messages
  static getMessages = asyncHandler(async (req, res) => {
    const { owner, conversation_id, page, limit, unread_only } = req.query;

    const targetOwner = CommunicationPolicy.resolveTargetOwner(req.user, owner);

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
  });

  // GET /api/v1/chat/messages/:id
  static getMessageById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const message = await ChatService.getMessageById(id);

    if (!CommunicationPolicy.canViewMessage(req.user, message)) {
      throw new ForbiddenError('Bạn không có quyền xem tin nhắn này');
    }

    return res.status(200).json({
      status: 'success',
      data: { message },
    });
  });

  // POST /api/v1/chat/messages
  static sendMessage = asyncHandler(async (req, res) => {
    const isStaff = CommunicationPolicy.isStaff(req.user);

    const payload = {
      ...req.body,
      sender_id: req.user?.id,
      sender_name: req.user?.name || req.body.sender_name,
      sender_role: isStaff ? (req.body.sender_role || 'shop') : 'customer',
      owner: isStaff ? (req.body.owner || req.user?.email) : req.user?.email,
      // Khách chỉ được gửi vào hội thoại của chính mình
      conversation_id: isStaff ? req.body.conversation_id : req.user?.id,
    };

    const message = await ChatService.sendMessage(payload);

    return res.status(201).json({
      status: 'success',
      message: 'Gửi tin nhắn thành công',
      data: { message },
    });
  });

  // PATCH /api/v1/chat/messages/:id/read
  static markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await ChatService.getMessageById(id);

    if (!CommunicationPolicy.canViewMessage(req.user, existing)) {
      throw new ForbiddenError('Bạn không có quyền cập nhật tin nhắn này');
    }

    const message = await ChatService.markAsRead(id);

    return res.status(200).json({
      status: 'success',
      message: 'Đã đánh dấu tin nhắn là đã đọc',
      data: { message },
    });
  });

  // PATCH /api/v1/chat/read-all
  static markAllAsRead = asyncHandler(async (req, res) => {
    const isStaff = CommunicationPolicy.isStaff(req.user);
    if (!isStaff) {
      const result = await communicationRepository.markConversationAsRead(
        req.user.id,
        req.user.email,
      );
      return res.status(200).json({
        status: 'success',
        message: `Đã đánh dấu ${result.updatedCount} tin nhắn là đã đọc`,
        data: result,
      });
    }
    const targetOwner = req.body.owner || req.query.owner || req.user?.email;
    const result = await ChatService.markAllAsRead(targetOwner);

    return res.status(200).json({
      status: 'success',
      message: `Đã đánh dấu ${result.updatedCount} tin nhắn là đã đọc`,
      data: result,
    });
  });

  // DELETE /api/v1/chat/messages/:id
  static deleteMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await ChatService.getMessageById(id);

    if (!CommunicationPolicy.canMutateMessage(req.user, existing)) {
      throw new ForbiddenError('Bạn không có quyền xóa tin nhắn này');
    }

    await ChatService.deleteMessage(id);

    return res.status(200).json({
      status: 'success',
      message: 'Xóa tin nhắn thành công',
    });
  });

  // DELETE /api/v1/chat/conversations/:owner
  static deleteConversation = asyncHandler(async (req, res) => {
    const { owner } = req.params;

    if (!CommunicationPolicy.canDeleteConversation(req.user, owner)) {
      throw new ForbiddenError('Bạn không có quyền xóa hội thoại này');
    }

    const result = await ChatService.deleteConversation(owner);

    return res.status(200).json({
      status: 'success',
      message: `Đã xóa hội thoại với ${result.deletedCount} tin nhắn`,
      data: result,
    });
  });

  // --- Contract CHAT01: Mở chat của khách ---
  static openCustomerConversation = asyncHandler(async (req, res) => {
    const conv = await communicationRepository.getOrCreateCustomerConversation(req.user);
    return res.status(200).json({
      status: 'success',
      data: conv,
    });
  });

  // --- Contract CHAT02: Nạp tin nhắn hội thoại của khách ---
  static getCustomerMessages = asyncHandler(async (req, res) => {
    const { conversation_id } = req.params;
    if (conversation_id !== req.user.id) {
      throw new ForbiddenError('Bạn không có quyền xem hội thoại này');
    }
    const { cursor, limit, after_id } = req.query;

    const result = await communicationRepository.getMessagesByConversation(conversation_id, {
      cursor,
      limit,
      after_id,
    });

    return res.status(200).json({
      status: 'success',
      data: result.messages,
      pagination: result.pagination,
    });
  });

  // --- Contract CHAT03: Khách gửi tin nhắn ---
  static sendCustomerMessage = asyncHandler(async (req, res) => {
    const { conversation_id } = req.params;
    if (conversation_id !== req.user.id) {
      throw new ForbiddenError('Bạn không có quyền gửi tin nhắn vào hội thoại này');
    }
    const { content, client_message_id } = req.body;

    const result = await communicationRepository.sendConversationMessage(
      conversation_id,
      req.user,
      { content, client_message_id, sender_role: 'customer' }
    );

    return res.status(201).json({
      status: 'success',
      data: result.message,
    });
  });

  // --- Contract ADM01: Quản trị lấy danh sách hội thoại ---
  static getAdminConversations = asyncHandler(async (req, res) => {
    const { keyword, page, limit } = req.query;
    const result = await communicationRepository.getAdminConversationsList({
      keyword,
      page,
      limit,
    });

    return res.status(200).json({
      status: 'success',
      data: result.conversations,
      pagination: result.pagination,
    });
  });

  // --- Contract ADM02: Quản trị nạp tin nhắn hội thoại ---
  static getAdminConversationMessages = asyncHandler(async (req, res) => {
    const { conversation_id } = req.params;
    const { cursor, limit, after_id } = req.query;

    const result = await communicationRepository.getMessagesByConversation(conversation_id, {
      cursor,
      limit,
      after_id,
    });

    return res.status(200).json({
      status: 'success',
      data: result.messages,
      customer: result.customer,
      pagination: result.pagination,
    });
  });

  // --- Contract ADM03: Shop gửi phản hồi ---
  static sendAdminMessage = asyncHandler(async (req, res) => {
    const { conversation_id } = req.params;
    const { content, client_message_id } = req.body;

    const result = await communicationRepository.sendConversationMessage(
      conversation_id,
      req.user,
      { content, client_message_id, sender_role: 'shop' }
    );

    return res.status(201).json({
      status: 'success',
      data: result.message,
      customer: result.customer,
    });
  });

  // ADM03: Shop tạo hội thoại mới theo email khách hàng
  static createAdminConversation = asyncHandler(async (req, res) => {
    const { email, content, client_message_id } = req.body;
    if (!email || !String(email).trim()) {
      throw new BadRequestError('Email khách hàng là bắt buộc');
    }
    const userRes = await communicationRepository.db.query(
      `SELECT id, name, email FROM users
       WHERE LOWER(email) = LOWER($1) AND LOWER(role) = 'customer' LIMIT 1;`,
      [String(email).trim()],
    );
    if (!userRes.rows[0]) {
      throw new NotFoundError('Không tìm thấy khách hàng');
    }
    const result = await communicationRepository.sendConversationMessage(
      userRes.rows[0].id,
      req.user,
      { content, client_message_id, sender_role: 'shop' },
    );
    return res.status(201).json({
      status: 'success',
      data: result.message,
      customer: userRes.rows[0],
    });
  });
}

export default ChatController;
