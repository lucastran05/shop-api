import pool from '../config/db.js';

class PaymentModel {
  // Lấy danh sách giao dịch thanh toán
  static async findAll({
    page = 1,
    limit = 20,
    order_id = '',
    user_id = '',
    status = '',
    payment_method = '',
    payment_type = '',
  } = {}) {
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
    const countRes = await pool.query(countQuery, values);
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
    const dataRes = await pool.query(dataQuery, values);

    return {
      payments: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Lấy chi tiết thanh toán theo ID
  static async findById(id) {
    const query = `
      SELECT p.id, p.order_id, p.user_id, p.amount, p.payment_method, p.payment_type,
             p.status, p.transaction_id, p.note, p.metadata, p.created_at, p.updated_at,
             u.name AS user_name, u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Lấy danh sách thanh toán theo order_id
  static async findByOrderId(orderId) {
    const query = `
      SELECT p.id, p.order_id, p.user_id, p.amount, p.payment_method, p.payment_type,
             p.status, p.transaction_id, p.note, p.metadata, p.created_at, p.updated_at,
             u.name AS user_name, u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.order_id = $1
      ORDER BY p.created_at DESC;
    `;
    const result = await pool.query(query, [orderId]);
    return result.rows;
  }

  // Tạo giao dịch thanh toán mới
  static async create({
    order_id,
    user_id = null,
    amount,
    payment_method = 'bank',
    payment_type = 'full',
    status = 'pending',
    transaction_id = null,
    note = '',
    metadata = {},
  }) {
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

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Cập nhật thông tin thanh toán
  static async update(id, fields = {}) {
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

    if (setClauses.length === 0) return await PaymentModel.findById(id);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE payments
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, order_id, user_id, amount, payment_method, payment_type,
                status, transaction_id, note, metadata, created_at, updated_at;
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Xóa giao dịch thanh toán
  static async delete(id) {
    const query = `
      DELETE FROM payments
      WHERE id = $1
      RETURNING id, order_id, amount;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }
}

export default PaymentModel;
