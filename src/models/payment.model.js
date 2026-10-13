import billingRepository from '../modules/billing/billing.repository.js';

class PaymentModel {
  static async findAll(filters) {
    return billingRepository.findAll(filters);
  }

  static async findById(id) {
    return billingRepository.findById(id);
  }

  static async findByOrderId(orderId) {
    return billingRepository.findByOrderId(orderId);
  }

  static async create(data) {
    return billingRepository.create(data);
  }

  static async update(id, fields) {
    return billingRepository.update(id, fields);
  }

  static async delete(id) {
    return billingRepository.delete(id);
  }
}

export default PaymentModel;
