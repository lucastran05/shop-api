import NotificationModel from '../models/notification.model.js';

class NotificationService {
  // Lấy danh sách thông báo
  static async getAllNotifications(filters) {
    return await NotificationModel.findAll(filters);
  }

  // Lấy chi tiết thông báo theo ID
  static async getNotificationById(id) {
    const notification = await NotificationModel.findById(id);
    if (!notification) {
      const error = new Error('Không tìm thấy thông báo');
      error.statusCode = 404;
      throw error;
    }
    return notification;
  }

  // Tạo thông báo mới
  static async createNotification(data) {
    const title = data.title;
    const message = data.message || data.text;

    if (!title || !title.trim()) {
      const error = new Error('Tiêu đề thông báo không được để trống');
      error.statusCode = 400;
      throw error;
    }

    if (!message || !message.trim()) {
      const error = new Error('Nội dung thông báo không được để trống');
      error.statusCode = 400;
      throw error;
    }

    return await NotificationModel.create({
      ...data,
      title: title.trim(),
      message: message.trim(),
    });
  }

  // Đánh dấu thông báo đã đọc
  static async markAsRead(id) {
    const existing = await NotificationModel.findById(id);
    if (!existing) {
      const error = new Error('Không tìm thấy thông báo');
      error.statusCode = 404;
      throw error;
    }

    return await NotificationModel.markAsRead(id);
  }

  // Đánh dấu tất cả thông báo đã đọc
  static async markAllAsRead({ user_id, owner }) {
    const updatedCount = await NotificationModel.markAllAsRead({ user_id, owner });
    return { updatedCount };
  }

  // Xóa một thông báo
  static async deleteNotification(id) {
    const existing = await NotificationModel.findById(id);
    if (!existing) {
      const error = new Error('Không tìm thấy thông báo để xóa');
      error.statusCode = 404;
      throw error;
    }

    return await NotificationModel.delete(id);
  }

  // Xóa tất cả thông báo đã đọc
  static async clearRead({ user_id, owner }) {
    const deletedCount = await NotificationModel.clearRead({ user_id, owner });
    return { deletedCount };
  }
}

export default NotificationService;
