import NotificationService from '../services/notification.service.js';
import NotificationPolicy from '../modules/notification/notification.policy.js';
import notificationRepository from '../modules/notification/notification.repository.js';
import { ForbiddenError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class NotificationController {
  // GET /api/v1/notifications (NOT01)
  static getAll = asyncHandler(async (req, res) => {
    const { user_id, owner, type, unread_only, page, limit } = req.query;

    const isStaff = NotificationPolicy.isStaff(req.user);
    const { targetUserId, targetOwner } = NotificationPolicy.resolveTargetRecipient(req.user, { user_id, owner });

    const result = await NotificationService.getAllNotifications({
      user_id: targetUserId,
      owner: targetOwner,
      type,
      unread_only,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      recipientMatch: !isStaff,
    });

    const formattedList = result.notifications.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.message || n.text || '',
      message: n.message || n.text || '',
      type: n.type || 'system',
      target_type: n.key || null,
      target_id: n.params?.target_id || null,
      is_read: Boolean(n.is_read || n.isRead),
      created_at: n.created_at || n.createdAt,
    }));

    // Nếu gọi không kèm query phân trang (tương thích test cũ), giữ data.notifications
    if (!page && !limit) {
      return res.status(200).json({
        status: 'success',
        data: {
          ...result,
          notifications: formattedList,
        },
        unread_count: result.unreadCount,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          total_pages: result.totalPages,
        },
      });
    }

    return res.status(200).json({
      status: 'success',
      data: formattedList,
      unread_count: result.unreadCount,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.totalPages,
      },
    });
  });

  // GET /api/v1/notifications/:id
  static getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const notification = await NotificationService.getNotificationById(id);

    if (!NotificationPolicy.canAccessNotification(req.user, notification)) {
      throw new ForbiddenError('Bạn không có quyền xem thông báo này');
    }

    return res.status(200).json({
      status: 'success',
      data: { notification },
    });
  });

  // POST /api/v1/notifications (Chỉ Admin / Manager)
  static create = asyncHandler(async (req, res) => {
    const payload = {
      ...req.body,
      user_id: req.body.user_id || null,
      owner: req.body.owner || '',
    };

    const notification = await NotificationService.createNotification(payload);

    return res.status(201).json({
      status: 'success',
      message: 'Tạo thông báo thành công',
      data: { notification },
    });
  });

  // PATCH /api/v1/notifications/:id/read (NOT02)
  static markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await notificationRepository.markSingleRead(id, req.user?.id);

    return res.status(200).json({
      status: 'success',
      message: 'Đã đánh dấu thông báo là đã đọc',
      data: result.notification,
      unread_count: result.unread_count,
    });
  });

  // POST /api/v1/notifications/read-all & PATCH /api/v1/notifications/mark-all-read (NOT03)
  static markAllAsRead = asyncHandler(async (req, res) => {
    const result = await notificationRepository.markAllCustomerRead(req.user?.id);

    return res.status(200).json({
      status: 'success',
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      data: {
        updated_count: result.updated_count,
        read_at: result.read_at,
      },
      unread_count: result.unread_count,
    });
  });

  // DELETE /api/v1/notifications/:id
  static delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const notification = await NotificationService.getNotificationById(id);

    if (!NotificationPolicy.canAccessNotification(req.user, notification)) {
      throw new ForbiddenError('Bạn không có quyền xóa thông báo này');
    }

    await NotificationService.deleteNotification(id);

    return res.status(200).json({
      status: 'success',
      message: 'Xóa thông báo thành công',
    });
  });

  // DELETE /api/v1/notifications/clear-read
  static clearRead = asyncHandler(async (req, res) => {
    const isStaff = NotificationPolicy.isStaff(req.user);
    const user_id = isStaff ? (req.body.user_id || req.query.user_id || req.user?.id) : req.user?.id;
    const owner = isStaff ? (req.body.owner || req.query.owner || req.user?.email) : req.user?.email;

    const result = await NotificationService.clearRead({ user_id, owner });

    return res.status(200).json({
      status: 'success',
      message: `Đã xóa ${result.deletedCount} thông báo đã đọc`,
      data: result,
    });
  });
}

export default NotificationController;
