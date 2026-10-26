import pool from '../../config/db.js';

const DISCOUNT_TYPES = new Set(['percentage', 'fixed', 'free_shipping']);

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function normalizeDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${field} không hợp lệ`);
    error.statusCode = 400;
    throw error;
  }
  return date.toISOString();
}

function validatePayload(payload, { partial = false } = {}) {
  const body = { ...payload };
  if (!partial || body.code !== undefined) {
    body.code = normalizeCode(body.code);
    if (!/^[A-Z0-9][A-Z0-9 _-]{1,48}[A-Z0-9]$/.test(body.code)) {
      const error = new Error('Mã voucher chỉ gồm chữ, số, khoảng trắng, dấu gạch ngang hoặc gạch dưới và dài 3-50 ký tự');
      error.statusCode = 400;
      throw error;
    }
  }
  if (!partial || body.name !== undefined) {
    body.name = String(body.name || '').trim();
    if (!body.name) {
      const error = new Error('Tên voucher không được để trống');
      error.statusCode = 400;
      throw error;
    }
    if (body.name.length > 255) {
      const error = new Error('Tên voucher không được vượt quá 255 ký tự');
      error.statusCode = 400;
      throw error;
    }
  }
  if (!partial || body.discount_type !== undefined) {
    body.discount_type = body.discount_type || 'percentage';
    if (!DISCOUNT_TYPES.has(body.discount_type)) {
      const error = new Error('Loại giảm giá không hợp lệ');
      error.statusCode = 400;
      throw error;
    }
  }
  for (const field of ['discount_value', 'min_order_amount', 'max_discount_amount']) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      body[field] = Number(body[field]);
      if (!Number.isFinite(body[field]) || body[field] < 0) {
        const error = new Error(`${field} phải là số không âm`);
        error.statusCode = 400;
        throw error;
      }
    }
  }
  if (body.discount_type === 'percentage' && Number(body.discount_value) > 100) {
    const error = new Error('Voucher phần trăm không được vượt quá 100');
    error.statusCode = 400;
    throw error;
  }
  if (body.usage_limit !== undefined && body.usage_limit !== null && body.usage_limit !== '') {
    body.usage_limit = Number(body.usage_limit);
    if (!Number.isInteger(body.usage_limit) || body.usage_limit < 0) {
      const error = new Error('Số lượt dùng phải là số nguyên không âm');
      error.statusCode = 400;
      throw error;
    }
  } else if (body.usage_limit === '') {
    body.usage_limit = null;
  }
  if (body.starts_at !== undefined) body.starts_at = normalizeDate(body.starts_at, 'Thời gian bắt đầu');
  if (body.expires_at !== undefined) body.expires_at = normalizeDate(body.expires_at, 'Thời gian kết thúc');
  if (body.starts_at && body.expires_at && new Date(body.starts_at) >= new Date(body.expires_at)) {
    const error = new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
    error.statusCode = 400;
    throw error;
  }
  if (body.active !== undefined) {
    if (typeof body.active === 'string') {
      if (!['true', 'false'].includes(body.active.toLowerCase())) {
        const error = new Error('Trạng thái voucher không hợp lệ');
        error.statusCode = 400;
        throw error;
      }
      body.active = body.active.toLowerCase() === 'true';
    } else {
      body.active = Boolean(body.active);
    }
  }
  return body;
}

function mapVoucher(row) {
  return {
    ...row,
    discount_value: Number(row.discount_value),
    min_order_amount: Number(row.min_order_amount),
    max_discount_amount: row.max_discount_amount === null ? null : Number(row.max_discount_amount),
    usage_limit: row.usage_limit === null ? null : Number(row.usage_limit),
    used_count: Number(row.used_count),
    remaining_count: row.usage_limit === null ? null : Math.max(0, Number(row.usage_limit) - Number(row.used_count)),
  };
}

export class VoucherRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async list({ keyword = '', active } = {}, client = this.db) {
    const values = [];
    const conditions = [];
    if (keyword.trim()) {
      values.push(`%${keyword.trim().toUpperCase()}%`);
      conditions.push(`(UPPER(code) LIKE $${values.length} OR LOWER(name) LIKE LOWER($${values.length}))`);
    }
    if (active !== undefined && active !== '') {
      values.push(active === true || active === 'true');
      conditions.push(`active = $${values.length}`);
    }
    const result = await client.query(`
      SELECT id, code, name, discount_type, discount_value, min_order_amount,
             max_discount_amount, usage_limit, used_count, starts_at, expires_at,
             active, created_by, created_at, updated_at
      FROM vouchers
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY created_at DESC;
    `, values);
    return result.rows.map(mapVoucher);
  }

  async listAvailable({ subtotal } = {}, client = this.db) {
    const values = [];
    const conditions = [
      'active = TRUE',
      '(starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)',
      '(expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)',
      '(usage_limit IS NULL OR used_count < usage_limit)',
    ];
    if (subtotal !== undefined && subtotal !== '') {
      const amount = Number(subtotal);
      if (!Number.isFinite(amount) || amount < 0) {
        const error = new Error('Giá trị đơn hàng không hợp lệ');
        error.statusCode = 400;
        throw error;
      }
      values.push(amount);
      conditions.push(`min_order_amount <= $${values.length}`);
    }
    const result = await client.query(`
      SELECT id, code, name, discount_type, discount_value, min_order_amount,
             max_discount_amount, usage_limit, used_count, starts_at, expires_at,
             active, created_at, updated_at
      FROM vouchers
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC;
    `, values);
    return result.rows.map(mapVoucher);
  }

  async findById(id, client = this.db) {
    const result = await client.query(`SELECT * FROM vouchers WHERE id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? mapVoucher(result.rows[0]) : null;
  }

  async create(payload, actorId, client = this.db) {
    const body = validatePayload(payload);
    try {
      const result = await client.query(`
        INSERT INTO vouchers (
          code, name, discount_type, discount_value, min_order_amount,
          max_discount_amount, usage_limit, starts_at, expires_at, active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `, [
        body.code,
        body.name,
        body.discount_type,
        body.discount_value ?? 0,
        body.min_order_amount ?? 0,
        body.max_discount_amount ?? null,
        body.usage_limit ?? null,
        body.starts_at ?? null,
        body.expires_at ?? null,
        body.active ?? true,
        actorId,
      ]);
      return mapVoucher(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        error.statusCode = 409;
        error.message = 'Mã voucher đã tồn tại';
      }
      throw error;
    }
  }

  async update(id, payload, client = this.db) {
    const current = await this.findById(id, client);
    if (!current) return null;
    // Validate the effective record, not just the patch. This prevents an
    // update of discount_value from bypassing the percentage <= 100 rule.
    const body = validatePayload({ ...current, ...payload });
    if (body.usage_limit !== null && body.usage_limit < current.used_count) {
      const error = new Error('Tổng lượt dùng không được nhỏ hơn số lượt đã sử dụng');
      error.statusCode = 400;
      throw error;
    }
    const fields = ['code', 'name', 'discount_type', 'discount_value', 'min_order_amount', 'max_discount_amount', 'usage_limit', 'starts_at', 'expires_at', 'active'];
    const sets = [];
    const values = [];
    for (const field of fields) {
      if (body[field] !== undefined) {
        values.push(body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }
    if (!sets.length) return this.findById(id, client);
    values.push(id);
    try {
      const result = await client.query(`
        UPDATE vouchers SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length}
        RETURNING *;
      `, values);
      return result.rows[0] ? mapVoucher(result.rows[0]) : null;
    } catch (error) {
      if (error.code === '23505') {
        error.statusCode = 409;
        error.message = 'Mã voucher đã tồn tại';
      }
      throw error;
    }
  }

  async delete(id, client = this.db) {
    const result = await client.query(`DELETE FROM vouchers WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }

  async bulkDelete(ids, client = this.db) {
    const result = await client.query(`DELETE FROM vouchers WHERE id = ANY($1::uuid[]) RETURNING id`, [ids]);
    const deleted_ids = result.rows.map((row) => row.id);
    return {
      deleted_ids,
      failed: ids.filter((id) => !deleted_ids.includes(id)).map((id) => ({
        id,
        code: 'NOT_FOUND',
        message: 'Không tìm thấy voucher',
      })),
    };
  }

  async calculateDiscount(code, { subtotal, shippingFee = 0 } = {}, client = this.db) {
    const cleanCode = normalizeCode(code);
    if (!cleanCode) return null;
    const result = await client.query(`
      SELECT * FROM vouchers
      WHERE code = $1
        AND active = TRUE
        AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
        AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)
        AND (usage_limit IS NULL OR used_count < usage_limit)
      FOR SHARE;
    `, [cleanCode]);
    const voucher = result.rows[0];
    if (!voucher) {
      const error = new Error('Voucher không tồn tại, đã hết hạn hoặc đã hết lượt dùng');
      error.statusCode = 400;
      error.code = 'VOUCHER_INVALID';
      throw error;
    }
    const orderSubtotal = Number(subtotal) || 0;
    if (orderSubtotal < Number(voucher.min_order_amount)) {
      const error = new Error(`Đơn tối thiểu để dùng voucher là ${Number(voucher.min_order_amount).toLocaleString('vi-VN')} đ`);
      error.statusCode = 400;
      error.code = 'VOUCHER_MIN_ORDER';
      throw error;
    }
    let discountAmount = 0;
    if (voucher.discount_type === 'free_shipping') discountAmount = Number(shippingFee) || 0;
    if (voucher.discount_type === 'fixed') discountAmount = Number(voucher.discount_value);
    if (voucher.discount_type === 'percentage') discountAmount = orderSubtotal * Number(voucher.discount_value) / 100;
    if (voucher.max_discount_amount !== null) discountAmount = Math.min(discountAmount, Number(voucher.max_discount_amount));
    discountAmount = Math.max(0, Math.min(Math.round(discountAmount), orderSubtotal + (Number(shippingFee) || 0)));
    return {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      discount_amount: discountAmount,
      discount_type: voucher.discount_type,
    };
  }

  async consume(id, client = this.db) {
    const result = await client.query(`
      UPDATE vouchers
      SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND active = TRUE AND (usage_limit IS NULL OR used_count < usage_limit)
        AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
        AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)
      RETURNING id, code, used_count, usage_limit;
    `, [id]);
    if (!result.rows[0]) {
      const error = new Error('Voucher đã hết lượt dùng, vui lòng chọn mã khác');
      error.statusCode = 409;
      error.code = 'VOUCHER_EXHAUSTED';
      throw error;
    }
    return result.rows[0];
  }
}

export const voucherRepository = new VoucherRepository();
export { normalizeCode, validatePayload };
