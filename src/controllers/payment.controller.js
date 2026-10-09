import PaymentService from '../services/payment.service.js';

class PaymentController {
  // GET /api/v1/payments
  static async getAll(req, res, next) {
    try {
      const {
        page,
        limit,
        order_id,
        user_id,
        status,
        payment_method,
        payment_type,
      } = req.query;

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      // Nếu là khách hàng bình thường, bắt buộc chỉ được xem thanh toán của chính mình
      const targetUserId = isStaff ? user_id : req.user?.id;

      const result = await PaymentService.getAllPayments({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        order_id,
        user_id: targetUserId,
        status,
        payment_method,
        payment_type,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/payments/:id
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await PaymentService.getPaymentById(id);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      const isOwner = payment.user_id === req.user?.id;

      if (!isStaff && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền xem thông tin giao dịch này',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/payments/order/:orderId
  static async getByOrderId(req, res, next) {
    try {
      const { orderId } = req.params;
      let payments = await PaymentService.getPaymentsByOrderId(orderId);

      const isStaff = ['admin', 'manager'].includes(req.user?.role);
      if (!isStaff) {
        payments = payments.filter((p) => p.user_id === req.user?.id);
        if (payments.length === 0) {
          return res.status(403).json({
            status: 'error',
            message: 'Bạn không có quyền xem thông tin giao dịch của đơn hàng này',
          });
        }
      }

      return res.status(200).json({
        status: 'success',
        data: { payments },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/payments
  static async create(req, res, next) {
    try {
      const isStaff = ['admin', 'manager'].includes(req.user?.role);

      // Nếu không phải admin/manager, luôn luôn gán user_id là id của chính người đang đăng nhập
      const paymentData = {
        ...req.body,
        user_id: isStaff ? (req.body.user_id || req.user?.id) : req.user?.id,
      };

      const payment = await PaymentService.createPayment(paymentData);

      return res.status(201).json({
        status: 'success',
        message: 'Tạo bản ghi thanh toán thành công',
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/payments/:id
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await PaymentService.updatePayment(id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật thanh toán thành công',
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/payments/:id/status
  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp trạng thái mới',
        });
      }

      const payment = await PaymentService.updatePaymentStatus(id, status);

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật trạng thái thanh toán thành công',
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/payments/:id
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      await PaymentService.deletePayment(id);

      return res.status(200).json({
        status: 'success',
        message: 'Xóa bản ghi thanh toán thành công',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default PaymentController;
