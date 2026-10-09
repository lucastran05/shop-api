import NotificationService from '../services/notification.service.js';

class NotificationController {
  // GET /api/v1/notifications
  static async getAll(req, res, next) {
    try {
      const { user_id, owner, type, unread_only, page, limit } = req.query;

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      // Khách hàng thông thường chỉ nhận thông báo của chính mình
      const targetUserId = isStaff ? user_id : req.user?.id;
      const targetOwner = isStaff ? owner : req.user?.email;

      const result = await NotificationService.getAllNotifications({
        user_id: targetUserId,
        owner: targetOwner,
        type,
        unread_only,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        recipientMatch: !isStaff,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/notifications/:id
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.getNotificationById(id);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isOwner =
        notification.user_id === req.user?.id ||
        (notification.owner && notification.owner.toLowerCase() === req.user?.email?.toLowerCase()) ||
        (!notification.user_id && !notification.owner);

      if (!isStaff && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền xem thông báo này',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: { notification },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/notifications (Chỉ Admin / Manager)
  static async create(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/notifications/:id/read
  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.getNotificationById(id);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isOwner =
        notification.user_id === req.user?.id ||
        (notification.owner && notification.owner.toLowerCase() === req.user?.email?.toLowerCase()) ||
        (!notification.user_id && !notification.owner);

      if (!isStaff && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền cập nhật thông báo này',
        });
      }

      const updated = await NotificationService.markAsRead(id);

      return res.status(200).json({
        status: 'success',
        message: 'Đã đánh dấu thông báo là đã đọc',
        data: { notification: updated },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/notifications/mark-all-read
  static async markAllAsRead(req, res, next) {
    try {
      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const user_id = isStaff ? (req.body.user_id || req.query.user_id || req.user?.id) : req.user?.id;
      const owner = isStaff ? (req.body.owner || req.query.owner || req.user?.email) : req.user?.email;

      const result = await NotificationService.markAllAsRead({ user_id, owner });

      return res.status(200).json({
        status: 'success',
        message: `Đã đánh dấu ${result.updatedCount} thông báo là đã đọc`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/notifications/:id
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.getNotificationById(id);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isOwner =
        notification.user_id === req.user?.id ||
        (notification.owner && notification.owner.toLowerCase() === req.user?.email?.toLowerCase());

      if (!isStaff && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền xóa thông báo này',
        });
      }

      await NotificationService.deleteNotification(id);

      return res.status(200).json({
        status: 'success',
        message: 'Xóa thông báo thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/notifications/clear-read
  static async clearRead(req, res, next) {
    try {
      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const user_id = isStaff ? (req.body.user_id || req.query.user_id || req.user?.id) : req.user?.id;
      const owner = isStaff ? (req.body.owner || req.query.owner || req.user?.email) : req.user?.email;

      const result = await NotificationService.clearRead({ user_id, owner });

      return res.status(200).json({
        status: 'success',
        message: `Đã xóa ${result.deletedCount} thông báo đã đọc`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default NotificationController;
