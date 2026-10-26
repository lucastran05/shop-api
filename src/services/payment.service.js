import billingRepository from "../modules/billing/billing.repository.js";
import BillingPolicy from "../modules/billing/billing.policy.js";
import {
  paymentAmount,
  transactionReference,
} from "../modules/billing/billing.validation.js";
import { BadRequestError, NotFoundError } from "../common/errors/AppError.js";

const statuses = ["pending", "completed", "failed", "refunded"];

class PaymentService {
  static getAllPayments(filters) {
    return billingRepository.findAll(filters);
  }

  static async getPaymentById(id) {
    const payment = await billingRepository.findById(id);
    if (!payment) throw new NotFoundError("Không tìm thấy bản ghi thanh toán");
    return payment;
  }

  static getPaymentsByOrderId(orderId) {
    return billingRepository.findByOrderId(orderId);
  }

  static async createPayment(data, actor) {
    if (typeof data.order_id !== "string" || !data.order_id.trim())
      throw new BadRequestError("Mã đơn hàng không hợp lệ");
    const amount = paymentAmount(data.amount);
    await billingRepository.getOrder(data.order_id, actor);
    const staff = BillingPolicy.isStaff(actor);
    const status = staff ? (data.status ?? "pending") : "pending";
    if (!statuses.includes(status))
      throw new BadRequestError("Trạng thái thanh toán không hợp lệ");
    return billingRepository.create({
      ...data,
      amount,
      status,
      transaction_id: staff ? data.transaction_id : null,
      user_id: BillingPolicy.resolveCreationUserId(actor, data.user_id),
    });
  }

  static async updatePayment(id, data) {
    await this.getPaymentById(id);
    const update = { ...data };
    if (update.amount !== undefined)
      update.amount = paymentAmount(update.amount);
    if (update.status !== undefined && !statuses.includes(update.status))
      throw new BadRequestError("Trạng thái thanh toán không hợp lệ");
    return billingRepository.update(id, update);
  }

  static updatePaymentStatus(id, status) {
    return this.updatePayment(id, { status });
  }

  static async deletePayment(id) {
    await this.getPaymentById(id);
    return billingRepository.delete(id);
  }

  static async processWebhook(provider, payload) {
    if (!payload || Array.isArray(payload) || typeof payload !== "object")
      throw new BadRequestError("Invalid webhook body");
    if (!["PAID", "succeeded", "completed", "success"].includes(payload.status))
      throw new BadRequestError(
        "Webhook must confirm a successful transaction",
      );
    const amount = paymentAmount(payload.amount);
    const ref = transactionReference(
      payload.transaction_reference ?? payload.transaction_id,
    );
    const reference = transactionReference(provider + ":" + ref);
    let orderId = payload.order_id || payload.orderId;
    let kind = "full";
    let currency = payload.currency;
    if (payload.payment_id) {
      const session = (
        await billingRepository.db.query(
          "SELECT * FROM payment_sessions WHERE id=$1",
          [payload.payment_id],
        )
      ).rows[0];
      if (!session) throw new NotFoundError("Payment session not found");
      if (
        session.provider !== provider ||
        Number(session.amount) !== amount ||
        (orderId && orderId !== session.order_id)
      )
        throw new BadRequestError("Webhook does not match payment session");
      orderId = session.order_id;
      kind = session.purpose;
      currency ??= session.currency;
    }
    if (typeof orderId !== "string" || !orderId)
      throw new BadRequestError("Order ID is required");
    if (typeof currency !== "string" || !currency)
      throw new BadRequestError("Currency is required");
    return billingRepository.confirmPayment(orderId, {
      kind,
      amount,
      currency,
      payment_id: payload.payment_id,
      transaction_reference: reference,
      note: "Verified webhook: " + provider,
    });
  }
}

export default PaymentService;
