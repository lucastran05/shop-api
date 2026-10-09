import PaymentModel from '../models/payment.model.js';

class PaymentService {
  // Lấy danh sách thanh toán
  static async getAllPayments(filters) {
    return await PaymentModel.findAll(filters);
  }

  // Lấy chi tiết thanh toán theo ID
  static async getPaymentById(id) {
    const payment = await PaymentModel.findById(id);
    if (!payment) {
      const error = new Error('Không tìm thấy bản ghi thanh toán');
      error.statusCode = 404;
      throw error;
    }
    return payment;
  }

  // Lấy danh sách thanh toán theo order_id
  static async getPaymentsByOrderId(orderId) {
    return await PaymentModel.findByOrderId(orderId);
  }

  // Tạo thanh toán mới
  static async createPayment(data) {
    const { order_id, amount } = data;

    if (!order_id || !order_id.toString().trim()) {
      const error = new Error('Mã đơn hàng (order_id) không được để trống');
      error.statusCode = 400;
      throw error;
    }

    if (amount === undefined || amount === null || Number(amount) <= 0) {
      const error = new Error('Số tiền thanh toán phải lớn hơn 0');
      error.statusCode = 400;
      throw error;
    }

    return await PaymentModel.create({
      ...data,
      order_id: order_id.toString().trim(),
      amount: Number(amount),
    });
  }

  // Cập nhật bản ghi thanh toán
  static async updatePayment(id, updateData) {
    const existing = await PaymentModel.findById(id);
    if (!existing) {
      const error = new Error('Không tìm thấy bản ghi thanh toán để cập nhật');
      error.statusCode = 404;
      throw error;
    }

    if (updateData.amount !== undefined && Number(updateData.amount) <= 0) {
      const error = new Error('Số tiền thanh toán phải lớn hơn 0');
      error.statusCode = 400;
      throw error;
    }

    return await PaymentModel.update(id, updateData);
  }

  // Cập nhật trạng thái thanh toán (pending, completed, failed, refunded)
  static async updatePaymentStatus(id, status) {
    const validStatuses = ['pending', 'completed', 'failed', 'refunded'];
    if (!validStatuses.includes(status)) {
      const error = new Error(`Trạng thái không hợp lệ. Các trạng thái cho phép: ${validStatuses.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }

    const existing = await PaymentModel.findById(id);
    if (!existing) {
      const error = new Error('Không tìm thấy bản ghi thanh toán');
      error.statusCode = 404;
      throw error;
    }

    return await PaymentModel.update(id, { status });
  }

  // Xóa bản ghi thanh toán
  static async deletePayment(id) {
    const existing = await PaymentModel.findById(id);
    if (!existing) {
      const error = new Error('Không tìm thấy bản ghi thanh toán để xóa');
      error.statusCode = 404;
      throw error;
    }

    return await PaymentModel.delete(id);
  }
}

export default PaymentService;
