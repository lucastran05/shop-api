import pool from "../../config/db.js";
import { withTransaction } from "../../config/transaction.js";
import { randomUUID } from "node:crypto";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../common/errors/AppError.js";
import BillingPolicy from "./billing.policy.js";
import {
  orderAmounts,
  paymentAmount,
  paymentPurpose,
  transactionReference,
} from "./billing.validation.js";

export class BillingRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async findAll(
    {
      page = 1,
      limit = 20,
      order_id = "",
      user_id = "",
      status = "",
      payment_method = "",
      payment_type = "",
    } = {},
    client = this.db,
  ) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = [];
    const values = [];

    if (order_id && order_id.trim()) {
      values.push(`%${order_id.trim().toLowerCase()}%`);
      conditions.push(`LOWER(order_id) LIKE $${values.length}`);
    }

    if (user_id && user_id.trim()) {
      values.push(user_id.trim());
      conditions.push(`user_id = $${values.length}`);
    }

    if (status && status.trim()) {
      values.push(status.trim());
      conditions.push(`status = $${values.length}`);
    }

    if (payment_method && payment_method.trim()) {
      values.push(payment_method.trim());
      conditions.push(`payment_method = $${values.length}`);
    }

    if (payment_type && payment_type.trim()) {
      values.push(payment_type.trim());
      conditions.push(`payment_type = $${values.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) AS total FROM payments ${whereClause};`;
    const countRes = await client.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT p.id, p.order_id, p.user_id, p.amount, p.payment_method, p.payment_type,
             p.status, p.transaction_id, p.note, p.metadata, p.created_at, p.updated_at,
             u.name AS user_name, u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const dataRes = await client.query(dataQuery, values);

    return {
      payments: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id, client = this.db) {
    const query = `
      SELECT p.id, p.order_id, p.user_id, p.amount, p.payment_method, p.payment_type,
             p.status, p.transaction_id, p.note, p.metadata, p.created_at, p.updated_at,
             u.name AS user_name, u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByOrderId(orderId, client = this.db) {
    const query = `
      SELECT p.id, p.order_id, p.user_id, p.amount, p.payment_method, p.payment_type,
             p.status, p.transaction_id, p.note, p.metadata, p.created_at, p.updated_at,
             u.name AS user_name, u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.order_id = $1
      ORDER BY p.created_at DESC;
    `;
    const result = await client.query(query, [orderId]);
    return result.rows;
  }

  async create(
    {
      order_id,
      user_id = null,
      amount,
      payment_method = "bank",
      payment_type = "full",
      status = "pending",
      transaction_id = null,
      note = "",
      metadata = {},
    },
    client = this.db,
  ) {
    const query = `
      INSERT INTO payments (
        order_id, user_id, amount, payment_method, payment_type,
        status, transaction_id, note, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, order_id, user_id, amount, payment_method, payment_type,
                status, transaction_id, note, metadata, created_at, updated_at;
    `;

    const values = [
      order_id,
      user_id || null,
      Number(amount) || 0,
      payment_method,
      payment_type,
      status,
      transaction_id || null,
      note || "",
      JSON.stringify(metadata || {}),
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async update(id, fields = {}, client = this.db) {
    const columnMap = {
      order_id: "order_id",
      user_id: "user_id",
      amount: "amount",
      payment_method: "payment_method",
      payment_type: "payment_type",
      status: "status",
      transaction_id: "transaction_id",
      note: "note",
      metadata: "metadata",
    };

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      const col = columnMap[key];
      if (col) {
        let value = val;
        if (col === "metadata" && typeof val === "object") {
          value = JSON.stringify(val);
        }
        values.push(value);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) return await this.findById(id, client);

    setClauses.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const query = `
      UPDATE payments
      SET ${setClauses.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, order_id, user_id, amount, payment_method, payment_type,
                status, transaction_id, note, metadata, created_at, updated_at;
    `;

    const result = await client.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id, client = this.db) {
    const query = `
      DELETE FROM payments
      WHERE id = $1
      RETURNING id, order_id, amount;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async getOrder(orderId, actor, client = this.db, lock = false) {
    const result = await client.query(
      "SELECT * FROM orders WHERE id = $1" + (lock ? " FOR UPDATE" : ""),
      [orderId],
    );
    const order = result.rows[0];
    if (!order) throw new NotFoundError("Order not found");
    if (!BillingPolicy.canViewPayment(actor, order))
      throw new ForbiddenError("Order access denied");
    return order;
  }

  async createPaymentSession(
    orderId,
    { method = "qr", purpose = "full" } = {},
    actor,
    client = this.db,
  ) {
    if (client === this.db)
      return withTransaction(this.db, (tx) =>
        this.createPaymentSession(orderId, { method, purpose }, actor, tx),
      );
    const order = await this.getOrder(orderId, actor, client, true);
    paymentPurpose(purpose);
    if (!["qr", "vietqr", "momo", "card", "bank_transfer"].includes(method))
      throw new BadRequestError("Invalid payment method");
    if (
      ["cancelled", "refunded"].includes(order.status) ||
      order.payment_status === "refunded"
    )
      throw new ConflictError("Order cannot be paid");
    const remaining = Number(order.remaining_amount);
    const due =
      purpose === "deposit"
        ? Math.min(
            remaining,
            Math.max(
              0,
              Number(order.deposit_amount) -
                (Number(order.paid_amount) - Number(order.refunded_amount)),
            ),
          )
        : remaining;
    const amount = paymentAmount(due);
    const provider = ["qr", "bank_transfer"].includes(method)
      ? "vietqr"
      : method;
    const qrImageUrl =
      "https://api.vietqr.io/image/970422-0901234567-compact2.jpg?amount=" +
      amount +
      "&addInfo=" +
      encodeURIComponent(order.code);
    // shortcut: payment links are sandbox placeholders; replace with a gateway adapter before accepting real online payments.
    const paymentUrl =
      "https://sandbox.vnpay.vn/paymentv2/vpcpay.html?orderId=" +
      order.id +
      "&amount=" +
      amount;
    const qrPayload =
      "00020101021238540010A0000007270124000697042201100901234567520460115303704540" +
      amount +
      "5802VN62190815" +
      order.code +
      "6304";
    const result = await client.query(
      "INSERT INTO payment_sessions (order_id, purpose, method, provider, status, amount, currency, qr_payload, qr_image_url, payment_url, expires_at) VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,CURRENT_TIMESTAMP + INTERVAL '15 minutes') RETURNING *",
      [
        orderId,
        purpose,
        method,
        provider,
        amount,
        order.currency || "VND",
        qrPayload,
        qrImageUrl,
        paymentUrl,
      ],
    );
    return { ...result.rows[0], amount: Number(result.rows[0].amount) };
  }

  async getPaymentSession(paymentId, actor, client = this.db) {
    const result = await client.query(
      "SELECT ps.*, o.user_id, o.payment_status, o.deposit_status, o.deposit_paid_at, o.paid_amount, o.remaining_amount FROM payment_sessions ps JOIN orders o ON ps.order_id = o.id WHERE ps.id = $1",
      [paymentId],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (!BillingPolicy.canViewPayment(actor, row))
      throw new ForbiddenError("Payment session access denied");
    const {
      user_id,
      payment_status,
      deposit_status,
      deposit_paid_at,
      paid_amount,
      remaining_amount,
      ...session
    } = row;
    return {
      ...session,
      status:
        row.status === "pending" && new Date(row.expires_at) <= new Date()
          ? "expired"
          : row.status,
      amount: Number(row.amount),
      order: {
        id: row.order_id,
        payment_status,
        deposit_status,
        deposit_paid_at,
        paid_amount: Number(paid_amount),
        remaining_amount: Number(remaining_amount),
      },
    };
  }

  async confirmPayment(orderId, data, client = this.db) {
    if (client === this.db)
      return withTransaction(this.db, (tx) =>
        this.confirmPayment(orderId, data, tx),
      );
    const {
      kind = "full",
      amount,
      note = "",
      confirmed_by = null,
      payment_id,
    } = data;
    paymentPurpose(kind);
    const ref = transactionReference(
      data.transaction_reference || randomUUID(),
    );
    const result = await client.query(
      "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
      [orderId],
    );
    const order = result.rows[0];
    if (!order) throw new NotFoundError("Order not found");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["payment:" + ref],
    );
    if (data.currency !== undefined && data.currency !== order.currency)
      throw new BadRequestError("Payment currency does not match order");
    const previous = (
      await client.query(
        "SELECT * FROM payment_confirmations WHERE transaction_reference = $1 ORDER BY confirmed_at LIMIT 1",
        [ref],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.order_id !== orderId ||
        previous.kind !== kind ||
        (amount !== undefined &&
          paymentAmount(amount) !== Number(previous.amount))
      ) {
        throw new ConflictError(
          "Transaction reference already used with different payment data",
        );
      }
      return {
        ...previous,
        amount: Number(previous.amount),
        order: orderAmounts(order),
      };
    }
    if (
      ["cancelled", "refunded"].includes(order.status) ||
      order.payment_status === "refunded"
    )
      throw new ConflictError("Order cannot be paid");
    const remaining = Number(order.remaining_amount);
    const confirmAmount = paymentAmount(
      amount === undefined
        ? kind === "deposit"
          ? Math.min(
              remaining,
              Math.max(
                0,
                Number(order.deposit_amount) -
                  (Number(order.paid_amount) - Number(order.refunded_amount)),
              ),
            )
          : remaining
        : amount,
    );
    if (confirmAmount > remaining)
      throw new BadRequestError("Payment exceeds remaining amount");
    if (payment_id) {
      const session = (
        await client.query(
          "SELECT * FROM payment_sessions WHERE id = $1 FOR UPDATE",
          [payment_id],
        )
      ).rows[0];
      if (
        !session ||
        session.order_id !== orderId ||
        session.purpose !== kind ||
        Number(session.amount) !== confirmAmount
      )
        throw new BadRequestError("Payment session does not match transaction");
      if (
        session.status !== "pending" ||
        new Date(session.expires_at) <= new Date()
      )
        throw new ConflictError("Payment session is not payable");
    }
    const paid =
      (Math.round(Number(order.paid_amount) * 100) +
        Math.round(confirmAmount * 100)) /
      100;
    const balance = Math.max(
      0,
      (Math.round(Number(order.total_amount) * 100) -
        Math.round(paid * 100) +
        Math.round(Number(order.refunded_amount) * 100)) /
        100,
    );
    const depositPaid =
      Number(order.deposit_amount) > 0 &&
      paid - Number(order.refunded_amount) >= Number(order.deposit_amount);
    const updated = (
      await client.query(
        "UPDATE orders SET paid_amount=$1, remaining_amount=$2, deposit_status=$3, deposit_paid_at=$4, payment_status=$5, status=CASE WHEN status='pending' THEN 'confirmed' ELSE status END, status_label=CASE WHEN status='pending' THEN $6 ELSE status_label END, updated_at=CURRENT_TIMESTAMP WHERE id=$7 RETURNING *",
        [
          paid,
          balance,
          depositPaid ? "paid" : order.deposit_status,
          depositPaid
            ? order.deposit_paid_at || new Date()
            : order.deposit_paid_at,
          balance === 0 ? "paid" : "partial",
          "\u0110\u00e3 x\u00e1c nh\u1eadn",
          orderId,
        ],
      )
    ).rows[0];
    const confirmation = (
      await client.query(
        "INSERT INTO payment_confirmations (order_id,kind,amount,transaction_reference,note,confirmed_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        [orderId, kind, confirmAmount, ref, note, confirmed_by],
      )
    ).rows[0];
    if (payment_id) {
      await client.query(
        "UPDATE payment_sessions SET status='succeeded', paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [payment_id],
      );
    } else {
      await client.query(
        "UPDATE payment_sessions SET status='succeeded', paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE order_id=$1 AND purpose=$2 AND amount=$3 AND status='pending' AND expires_at>CURRENT_TIMESTAMP",
        [orderId, kind, confirmAmount],
      );
    }
    return {
      ...confirmation,
      amount: Number(confirmation.amount),
      order: orderAmounts(updated),
    };
  }

  async refundOrder(orderId, data, client = this.db) {
    if (client === this.db)
      return withTransaction(this.db, (tx) =>
        this.refundOrder(orderId, data, tx),
      );
    const { amount, reason = "" } = data;
    const ref = transactionReference(
      data.transaction_reference || randomUUID(),
    );
    const order = (
      await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        orderId,
      ])
    ).rows[0];
    if (!order) throw new NotFoundError("Order not found");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["refund:" + ref],
    );
    const previous = (
      await client.query(
        "SELECT * FROM refunds WHERE transaction_reference=$1 ORDER BY requested_at LIMIT 1",
        [ref],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.order_id !== orderId ||
        (amount !== undefined &&
          paymentAmount(amount) !== Number(previous.amount))
      )
        throw new ConflictError(
          "Transaction reference already used with different refund data",
        );
      return {
        ...previous,
        amount: Number(previous.amount),
        order: orderAmounts(order),
      };
    }
    const refundable =
      (Math.round(Number(order.paid_amount) * 100) -
        Math.round(Number(order.refunded_amount) * 100)) /
      100;
    const refundAmount = paymentAmount(
      amount === undefined ? refundable : amount,
    );
    if (refundAmount > refundable)
      throw new BadRequestError("Refund exceeds refundable amount");
    const refunded =
      (Math.round(Number(order.refunded_amount) * 100) +
        Math.round(refundAmount * 100)) /
      100;
    const remaining =
      (Math.round(Number(order.total_amount) * 100) -
        Math.round(Number(order.paid_amount) * 100) +
        Math.round(refunded * 100)) /
      100;
    const updated = (
      await client.query(
        "UPDATE orders SET refunded_amount=$1, remaining_amount=$2, payment_status=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *",
        [
          refunded,
          Math.max(0, remaining),
          refunded >= Number(order.paid_amount)
            ? "refunded"
            : order.payment_status,
          orderId,
        ],
      )
    ).rows[0];
    const refund = (
      await client.query(
        "INSERT INTO refunds (order_id,amount,status,reason,transaction_reference) VALUES ($1,$2,'completed',$3,$4) RETURNING *",
        [orderId, refundAmount, reason, ref],
      )
    ).rows[0];
    return {
      ...refund,
      amount: Number(refund.amount),
      order: orderAmounts(updated),
    };
  }
}

export const billingRepository = new BillingRepository();
export default billingRepository;
