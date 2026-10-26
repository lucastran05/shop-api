import PaymentService from '../services/payment.service.js';
import BillingPolicy from '../modules/billing/billing.policy.js';
import billingRepository from '../modules/billing/billing.repository.js';

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

      const targetUserId = BillingPolicy.resolveTargetUserId(req.user, user_id);

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

      if (!BillingPolicy.canViewPayment(req.user, payment)) {
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

      if (!BillingPolicy.isStaff(req.user)) {
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
      const paymentData = {
        ...req.body,
        user_id: BillingPolicy.resolveCreationUserId(req.user, req.body.user_id),
      };

      const payment = await PaymentService.createPayment(paymentData, req.user);

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

  // POST /api/v1/orders/:order_id/payment-sessions (PAY01)
  static async createSession(req, res, next) {
    try {
      const { order_id } = req.params;
      const { method, purpose } = req.body;

      const session = await billingRepository.createPaymentSession(order_id, {
        method: method || 'qr',
        purpose: purpose || 'full',
      }, req.user);

      return res.status(201).json({
        status: 'success',
        message: 'Tạo phiên thanh toán thành công',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/payments/:id (PAY02)
  static async getSession(req, res, next) {
    try {
      const { id } = req.params;
      const session = await billingRepository.getPaymentSession(id, req.user);

      if (!session) {
        // Fallback kiểm tra trong payments bảng cũ
        return await PaymentController.getById(req, res, next);
      }

      return res.status(200).json({
        status: 'success',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/orders/:order_id/payment-confirmations (ADY01)
  static async confirmPayment(req, res, next) {
    try {
      const { order_id } = req.params;
      const { kind, amount, transaction_reference, note } = req.body;

      const result = await billingRepository.confirmPayment(order_id, {
        kind: kind || 'full',
        amount,
        transaction_reference,
        note,
        confirmed_by: req.user?.id || null,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Ghi nhận thanh toán thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/orders/:order_id/refunds (ADY02)
  static async refund(req, res, next) {
    try {
      const { order_id } = req.params;
      const { amount, reason, transaction_reference } = req.body;

      const result = await billingRepository.refundOrder(order_id, {
        amount,
        reason,
        transaction_reference,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Ghi nhận hoàn tiền thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/payments/webhooks/:provider (SYS01)
  static async webhook(req, res, next) {
    try {
      const provider = req.paymentProvider;
      await PaymentService.processWebhook(provider, req.body);

      return res.status(200).json({
        status: 'success',
        message: `Webhook ${provider} đã được ghi nhận`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default PaymentController;
