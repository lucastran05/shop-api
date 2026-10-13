import notificationRepository from '../modules/notification/notification.repository.js';

class NotificationModel {
  static async findAll(filters) {
    return notificationRepository.findAll(filters);
  }

  static async findById(id) {
    return notificationRepository.findById(id);
  }

  static async create(data) {
    return notificationRepository.create(data);
  }

  static async markAsRead(id) {
    return notificationRepository.markAsRead(id);
  }

  static async markAllAsRead(filters) {
    return notificationRepository.markAllAsRead(filters);
  }

  static async delete(id) {
    return notificationRepository.delete(id);
  }

  static async clearRead(filters) {
    return notificationRepository.clearRead(filters);
  }
}

export default NotificationModel;
