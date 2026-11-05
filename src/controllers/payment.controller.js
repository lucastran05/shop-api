import PaymentService from '../services/payment.service.js';
import BillingPolicy from '../modules/billing/billing.policy.js';
import billingRepository from '../modules/billing/billing.repository.js';
import { BadRequestError, ForbiddenError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class PaymentController {
  // GET /api/v1/payments
  static getAll = asyncHandler(async (req, res) => {
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
  });

  // GET /api/v1/payments/:id
  static getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payment = await PaymentService.getPaymentById(id);

    if (!BillingPolicy.canViewPayment(req.user, payment)) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin giao dịch này');
    }

    return res.status(200).json({
      status: 'success',
      data: { payment },
    });
  });

  // GET /api/v1/payments/order/:orderId
  static getByOrderId = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    let payments = await PaymentService.getPaymentsByOrderId(orderId);

    if (!BillingPolicy.isStaff(req.user)) {
      payments = payments.filter((p) => p.user_id === req.user?.id);
      if (payments.length === 0) {
        throw new ForbiddenError('Bạn không có quyền xem thông tin giao dịch của đơn hàng này');
      }
    }

    return res.status(200).json({
      status: 'success',
      data: { payments },
    });
  });

  // POST /api/v1/payments
  static create = asyncHandler(async (req, res) => {
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
  });

  // PUT /api/v1/payments/:id
  static update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payment = await PaymentService.updatePayment(id, req.body);

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật thanh toán thành công',
      data: { payment },
    });
  });

  // PATCH /api/v1/payments/:id/status
  static updateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new BadRequestError('Vui lòng cung cấp trạng thái mới');
    }

    const payment = await PaymentService.updatePaymentStatus(id, status);

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật trạng thái thanh toán thành công',
      data: { payment },
    });
  });

  // DELETE /api/v1/payments/:id
  static delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await PaymentService.deletePayment(id);

    return res.status(200).json({
      status: 'success',
      message: 'Xóa bản ghi thanh toán thành công',
    });
  });

  // POST /api/v1/orders/:order_id/payment-sessions (PAY01)
  static createSession = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { method, purpose } = req.body;

    const session = await billingRepository.createPaymentSession(order_id, {
      method: method || 'qr',
      purpose: purpose || 'full',
      idempotency_key: req.get('Idempotency-Key'),
    }, req.user);

    return res.status(201).json({
      status: 'success',
      message: 'Tạo phiên thanh toán thành công',
      data: session,
    });
  });

  // GET /api/v1/payments/:id (PAY02)
  static getSession = asyncHandler(async (req, res, next) => {
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
  });

  // POST /admin/orders/:order_id/payment-confirmations (ADY01)
  static confirmPayment = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { kind, amount, transaction_reference, note } = req.body;

    const result = await billingRepository.confirmPayment(order_id, {
      kind: kind || 'full',
      amount,
      transaction_reference,
      note,
      confirmed_by: req.user?.id || null,
      idempotency_key: req.get('Idempotency-Key'),
    });

    return res.status(200).json({
      status: 'success',
      message: 'Ghi nhận thanh toán thành công',
      data: result,
    });
  });

  // POST /admin/orders/:order_id/refunds (ADY02)
  static refund = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { amount, reason, transaction_reference } = req.body;

    const result = await billingRepository.refundOrder(order_id, {
      amount,
      reason,
      transaction_reference,
      refunded_by: req.user.id,
      idempotency_key: req.get('Idempotency-Key'),
    });

    return res.status(200).json({
      status: 'success',
      message: 'Ghi nhận hoàn tiền thành công',
      data: result,
    });
  });

  // POST /api/v1/payments/webhooks/:provider (SYS01)
  static webhook = asyncHandler(async (req, res) => {
    const provider = req.paymentProvider;
    await PaymentService.processWebhook(provider, req.body);

    return res.status(200).json({
      status: 'success',
      message: `Webhook ${provider} đã được ghi nhận`,
    });
  });
}

export default PaymentController;
