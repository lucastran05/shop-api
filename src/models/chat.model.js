import communicationRepository from '../modules/communication/communication.repository.js';

class ChatModel {
  static async getConversations() {
    return communicationRepository.getConversations();
  }

  static async findMessages(filters) {
    return communicationRepository.findMessages(filters);
  }

  static async findById(id) {
    return communicationRepository.findById(id);
  }

  static async create(data) {
    return communicationRepository.create(data);
  }

  static async markAsRead(id) {
    return communicationRepository.markAsRead(id);
  }

  static async markAllAsRead(owner) {
    return communicationRepository.markAllAsRead(owner);
  }

  static async delete(id) {
    return communicationRepository.delete(id);
  }

  static async deleteConversation(owner) {
    return communicationRepository.deleteConversation(owner);
  }
}

export default ChatModel;
