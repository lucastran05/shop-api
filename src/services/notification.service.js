import notificationRepository from '../modules/notification/notification.repository.js';
import { BadRequestError, NotFoundError } from '../common/errors/AppError.js';

class NotificationService {
  // Lấy danh sách thông báo
  static async getAllNotifications(filters) {
    return await notificationRepository.findAll(filters);
  }

  // Lấy chi tiết thông báo theo ID
  static async getNotificationById(id) {
    const notification = await notificationRepository.findById(id);
    if (!notification) {
      throw new NotFoundError('Không tìm thấy thông báo');
    }
    return notification;
  }

  // Tạo thông báo mới
  static async createNotification(data) {
    const title = data.title;
    const message = data.message || data.text;

    if (!title || !title.trim()) {
      throw new BadRequestError('Tiêu đề thông báo không được để trống');
    }

    if (!message || !message.trim()) {
      throw new BadRequestError('Nội dung thông báo không được để trống');
    }

    return await notificationRepository.create({
      ...data,
      title: title.trim(),
      message: message.trim(),
    });
  }

  // Xóa một thông báo
  static async deleteNotification(id) {
    const existing = await notificationRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Không tìm thấy thông báo để xóa');
    }

    return await notificationRepository.delete(id);
  }

  // Xóa tất cả thông báo đã đọc
  static async clearRead({ user_id, owner }) {
    const deletedCount = await notificationRepository.clearRead({ user_id, owner });
    return { deletedCount };
  }
}

export default NotificationService;
