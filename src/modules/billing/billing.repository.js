import pool from '../../config/db.js';

export class BillingRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async findAll({
    page = 1,
    limit = 20,
    order_id = '',
    user_id = '',
    status = '',
    payment_method = '',
    payment_type = '',
  } = {}, client = this.db) {
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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

  async create({
    order_id,
    user_id = null,
    amount,
    payment_method = 'bank',
    payment_type = 'full',
    status = 'pending',
    transaction_id = null,
    note = '',
    metadata = {},
  }, client = this.db) {
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
      note || '',
      JSON.stringify(metadata || {}),
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async update(id, fields = {}, client = this.db) {
    const columnMap = {
      order_id: 'order_id',
      user_id: 'user_id',
      amount: 'amount',
      payment_method: 'payment_method',
      payment_type: 'payment_type',
      status: 'status',
      transaction_id: 'transaction_id',
      note: 'note',
      metadata: 'metadata',
    };

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      const col = columnMap[key];
      if (col) {
        let value = val;
        if (col === 'metadata' && typeof val === 'object') {
          value = JSON.stringify(val);
        }
        values.push(value);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) return await this.findById(id, client);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE payments
      SET ${setClauses.join(', ')}
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

  // --- PAY01: Tạo phiên thanh toán (Payment Session) ---

  async createPaymentSession(orderId, { method = 'qr', purpose = 'full', provider = 'vietqr' } = {}, client = this.db) {
    const orderRes = await client.query(`
      SELECT id, code, total_amount, deposit_amount, remaining_amount, currency
      FROM orders
      WHERE id = $1;
    `, [orderId]);
    if (orderRes.rows.length === 0) {
      const err = new Error('Không tìm thấy đơn hàng để tạo phiên thanh toán');
      err.statusCode = 404;
      throw err;
    }

    const order = orderRes.rows[0];
    const amount = purpose === 'deposit' ? Number(order.deposit_amount) : Number(order.remaining_amount || order.total_amount);

    const qrPayload = `00020101021238540010A0000007270124000697042201100901234567520460115303704540${amount}5802VN62190815${order.code}6304`;
    const qrImageUrl = `https://api.vietqr.io/image/970422-0901234567-compact2.jpg?amount=${amount}&addInfo=${encodeURIComponent(order.code)}`;
    const paymentUrl = `https://sandbox.vnpay.vn/paymentv2/vpcpay.html?orderId=${order.id}&amount=${amount}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const query = `
      INSERT INTO payment_sessions (
        order_id, purpose, method, provider, status, amount, currency,
        qr_payload, qr_image_url, payment_url, expires_at
      )
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10)
      RETURNING id, order_id, purpose, method, provider, status, amount, currency,
                qr_payload, qr_image_url, payment_url, expires_at, paid_at, failure_code, created_at;
    `;
    const res = await client.query(query, [
      orderId,
      purpose,
      method,
      provider,
      amount,
      order.currency || 'VND',
      qrPayload,
      qrImageUrl,
      paymentUrl,
      expiresAt,
    ]);

    const session = res.rows[0];
    return {
      ...session,
      amount: Number(session.amount),
    };
  }

  // --- PAY02: Theo dõi phiên thanh toán ---

  async getPaymentSession(paymentId, client = this.db) {
    const query = `
      SELECT ps.*,
             o.id AS order_id, o.payment_status, o.deposit_status, o.deposit_paid_at,
             o.paid_amount, o.remaining_amount
      FROM payment_sessions ps
      JOIN orders o ON ps.order_id = o.id
      WHERE ps.id = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [paymentId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      order_id: row.order_id,
      purpose: row.purpose,
      method: row.method,
      provider: row.provider,
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency,
      qr_payload: row.qr_payload,
      qr_image_url: row.qr_image_url,
      payment_url: row.payment_url,
      expires_at: row.expires_at,
      paid_at: row.paid_at,
      failure_code: row.failure_code,
      created_at: row.created_at,
      order: {
        id: row.order_id,
        payment_status: row.payment_status,
        deposit_status: row.deposit_status,
        deposit_paid_at: row.deposit_paid_at,
        paid_amount: Number(row.paid_amount),
        remaining_amount: Number(row.remaining_amount),
      },
    };
  }

  // --- ADY01: Xác nhận thu cọc hoặc thu đủ ---

  async confirmPayment(orderId, { kind = 'full', amount, transaction_reference = '', note = '', confirmed_by = null }, client = this.db) {
    const oRes = await client.query(`SELECT * FROM orders WHERE id = $1;`, [orderId]);
    if (oRes.rows.length === 0) {
      const err = new Error('Không tìm thấy đơn hàng');
      err.statusCode = 404;
      throw err;
    }

    const order = oRes.rows[0];
    if (['cancelled', 'refunded'].includes(order.status)) {
      const err = new Error('Không thể xác nhận thanh toán cho đơn đã hủy');
      err.statusCode = 400;
      throw err;
    }
    const confirmAmount = Number(amount) || (kind === 'deposit' ? Number(order.deposit_amount) : Number(order.remaining_amount));
    if (confirmAmount <= 0 || confirmAmount > Number(order.remaining_amount)) {
      const err = new Error('Số tiền xác nhận vượt quá số tiền còn phải trả');
      err.statusCode = 400;
      throw err;
    }

    const newPaid = Number(order.paid_amount) + confirmAmount;
    const newRemaining = Math.max(0, Number(order.total_amount) - newPaid);

    let newDepositStatus = order.deposit_status;
    let newDepositPaidAt = order.deposit_paid_at;
    let newPaymentStatus = order.payment_status;

    if (kind === 'deposit' || confirmAmount >= Number(order.deposit_amount)) {
      newDepositStatus = 'paid';
      if (!newDepositPaidAt) newDepositPaidAt = new Date().toISOString();
    }

    if (newRemaining <= 0) {
      newPaymentStatus = 'paid';
    } else if (newPaid > 0) {
      newPaymentStatus = 'partial';
    }

    // Cập nhật đơn hàng
    const updateOrderQuery = `
      UPDATE orders
      SET paid_amount = $1,
          remaining_amount = $2,
          deposit_status = $3,
          deposit_paid_at = $4,
          payment_status = $5,
          status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
          status_label = CASE WHEN status = 'pending' THEN 'Đã xác nhận' ELSE status_label END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, code, status, status_label, payment_status, deposit_status,
                deposit_paid_at, total_amount, deposit_amount, paid_amount,
                refunded_amount, held_amount, remaining_amount, created_at, updated_at;
    `;
    const updatedOrderRes = await client.query(updateOrderQuery, [
      newPaid,
      newRemaining,
      newDepositStatus,
      newDepositPaidAt,
      newPaymentStatus,
      orderId,
    ]);
    const updatedOrder = updatedOrderRes.rows[0];

    // Ghi vào bảng payment_confirmations
    const confQuery = `
      INSERT INTO payment_confirmations (
        order_id, kind, amount, transaction_reference, note, confirmed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, order_id, kind, amount, transaction_reference, status, confirmed_by, confirmed_at;
    `;
    const confRes = await client.query(confQuery, [
      orderId,
      kind,
      confirmAmount,
      transaction_reference || `REF-${Date.now()}`,
      note,
      confirmed_by,
    ]);
    const confirmation = confRes.rows[0];

    return {
      id: confirmation.id,
      order_id: confirmation.order_id,
      kind: confirmation.kind,
      amount: Number(confirmation.amount),
      transaction_reference: confirmation.transaction_reference,
      status: confirmation.status,
      confirmed_by: confirmation.confirmed_by,
      confirmed_at: confirmation.confirmed_at,
      order: {
        ...updatedOrder,
        total_amount: Number(updatedOrder.total_amount),
        deposit_amount: Number(updatedOrder.deposit_amount),
        paid_amount: Number(updatedOrder.paid_amount),
        refunded_amount: Number(updatedOrder.refunded_amount),
        held_amount: Number(updatedOrder.held_amount),
        remaining_amount: Number(updatedOrder.remaining_amount),
      },
    };
  }

  // --- ADY02: Ghi nhận hoàn tiền ---

  async refundOrder(orderId, { amount, reason = '', transaction_reference = '' }, client = this.db) {
    const oRes = await client.query(`SELECT * FROM orders WHERE id = $1;`, [orderId]);
    if (oRes.rows.length === 0) {
      const err = new Error('Không tìm thấy đơn hàng');
      err.statusCode = 404;
      throw err;
    }

    const order = oRes.rows[0];
    const refundAmount = Number(amount) || Number(order.paid_amount);
    const refundableAmount = Number(order.paid_amount) - Number(order.refunded_amount);

    if (refundableAmount <= 0) {
      const err = new Error('Đơn hàng đã được hoàn tiền đầy đủ');
      err.statusCode = 400;
      throw err;
    }

    if (refundAmount <= 0 || refundAmount > refundableAmount) {
      const err = new Error('Số tiền hoàn không được vượt quá số tiền đã thanh toán');
      err.statusCode = 400;
      throw err;
    }

    const newRefunded = Number(order.refunded_amount) + refundAmount;
    const newRemaining = Math.max(0, Number(order.total_amount) - (Number(order.paid_amount) - newRefunded));

    let newPaymentStatus = order.payment_status;
    if (newRefunded >= Number(order.paid_amount)) {
      newPaymentStatus = 'refunded';
    }

    const updateOrderQuery = `
      UPDATE orders
      SET refunded_amount = $1,
          remaining_amount = $2,
          payment_status = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, code, status, status_label, payment_status, deposit_status,
                deposit_paid_at, total_amount, deposit_amount, paid_amount,
                refunded_amount, held_amount, remaining_amount, created_at, updated_at;
    `;
    const updatedOrderRes = await client.query(updateOrderQuery, [
      newRefunded,
      newRemaining,
      newPaymentStatus,
      orderId,
    ]);
    const updatedOrder = updatedOrderRes.rows[0];

    const refQuery = `
      INSERT INTO refunds (
        order_id, amount, status, reason, transaction_reference
      )
      VALUES ($1, $2, 'completed', $3, $4)
      RETURNING id, order_id, amount, status, reason, transaction_reference, requested_at, completed_at;
    `;
    const refRes = await client.query(refQuery, [
      orderId,
      refundAmount,
      reason,
      transaction_reference || `TXR-${Date.now()}`,
    ]);
    const refund = refRes.rows[0];

    return {
      id: refund.id,
      order_id: refund.order_id,
      amount: Number(refund.amount),
      status: refund.status,
      reason: refund.reason,
      transaction_reference: refund.transaction_reference,
      requested_at: refund.requested_at,
      completed_at: refund.completed_at,
      order: {
        ...updatedOrder,
        total_amount: Number(updatedOrder.total_amount),
        deposit_amount: Number(updatedOrder.deposit_amount),
        paid_amount: Number(updatedOrder.paid_amount),
        refunded_amount: Number(updatedOrder.refunded_amount),
        held_amount: Number(updatedOrder.held_amount),
        remaining_amount: Number(updatedOrder.remaining_amount),
      },
    };
  }
}

export const billingRepository = new BillingRepository();
export default billingRepository;
