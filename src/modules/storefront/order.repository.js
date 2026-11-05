import pool from '../../config/db.js';
import { withTransaction } from '../../config/transaction.js';
import { withIdempotency } from '../../config/idempotency.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { currentStock, lockProduct, parseJsonArray, saveStock } from '../catalog/productStock.js';
import cartRepository from './cart.repository.js';
import { LOW_STOCK_THRESHOLD } from './inventory.repository.js';
import { voucherRepository } from './voucher.repository.js';
import { calculateQuote, findQuote, forgetQuote } from './quote.js';
import {
  ORDER_STATUS_LABELS,
  allowedNextStatuses,
  canCustomerCancel,
  hasAdminWorkflow,
  statusLabel,
} from './orderStatus.js';

// pg trả cột NUMERIC dưới dạng chuỗi; các cột tiền này luôn được đổi sang số trước khi trả về
const AMOUNT_FIELDS = [
  'subtotal', 'shipping_fee', 'discount_amount', 'total_amount', 'deposit_rate', 'deposit_amount',
  'amount_due_now', 'paid_amount', 'refunded_amount', 'held_amount', 'remaining_amount',
];

function withNumericAmounts(row) {
  const result = { ...row };
  for (const field of AMOUNT_FIELDS) if (field in result) result[field] = Number(result[field]);
  return result;
}

const mapItem = (item) => ({ ...item, unit_price: Number(item.unit_price), line_total: Number(item.line_total) });

const asObject = (value) => (value && typeof value === 'object' ? value : {});

// Các trường chung của một đơn hàng khi trả cho FE (khách và quản trị)
function mapOrder(row, items) {
  return {
    ...withNumericAmounts({
      id: row.id,
      code: row.code,
      status: row.status,
      status_label: statusLabel(row),
      payment_status: row.payment_status,
      deposit_status: row.deposit_status,
      deposit_paid_at: row.deposit_paid_at,
      payment_method: row.payment_method,
      payment_mode: row.payment_mode,
      delivery_method: row.delivery_method,
      subtotal: row.subtotal,
      shipping_fee: row.shipping_fee,
      discount_amount: row.discount_amount,
      total_amount: row.total_amount,
      deposit_rate: row.deposit_rate,
      deposit_amount: row.deposit_amount,
      amount_due_now: row.amount_due_now,
      paid_amount: row.paid_amount,
      refunded_amount: row.refunded_amount,
      held_amount: row.held_amount,
      remaining_amount: row.remaining_amount,
    }),
    currency: row.currency || 'VND',
    recipient: asObject(row.recipient),
    shipment: asObject(row.shipment),
    history: Array.isArray(row.history) ? row.history : [],
    items: items.map(mapItem),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Thông tin khách cho màn quản trị; đơn không còn tài khoản thì lấy từ người nhận
function mapCustomer(row) {
  const recipient = asObject(row.recipient);
  return {
    id: row.user_id || null,
    name: row.user_name || recipient.name || 'Khách vãng lai',
    email: row.user_email || 'Chưa cung cấp',
    phone: row.user_phone || recipient.phone || '',
  };
}

const ORDER_ITEMS_JSON = `
  COALESCE((SELECT json_agg(json_build_object(
    'product_id', oi.product_id, 'variant_id', oi.variant_id,
    'product_name', oi.product_name, 'variant_label', oi.variant_label,
    'color', oi.color, 'image_url', oi.image_url,
    'unit_price', oi.unit_price, 'quantity', oi.quantity,
    'line_total', oi.line_total
  )) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items`;

const LIST_COLUMNS = `
  o.id, o.code, o.status, o.status_label, o.payment_status, o.deposit_status,
  o.deposit_paid_at, o.payment_method, o.payment_mode, o.delivery_method,
  o.subtotal, o.shipping_fee, o.discount_amount,
  o.total_amount, o.deposit_rate, o.deposit_amount, o.amount_due_now,
  o.paid_amount, o.refunded_amount, o.held_amount, o.remaining_amount,
  o.currency, o.recipient, o.shipment, o.history, o.note,
  o.created_at, o.updated_at`;

const CUSTOMER_COLUMNS = 'u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone';

async function loadItems(client, orderId) {
  const { rows } = await client.query(
    `SELECT product_id, variant_id, product_name, variant_label, color,
            image_url, unit_price, quantity, line_total
     FROM order_items WHERE order_id = $1;`,
    [orderId],
  );
  return rows;
}

function pagination(page, limit) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = parseInt(limit, 10) || 20;
  return { pageNum, limitNum, offset: (pageNum - 1) * limitNum };
}

const paginationResult = (pageNum, limitNum, total) => ({
  page: pageNum,
  limit: limitNum,
  total,
  total_pages: Math.ceil(total / limitNum) || 1,
});

const historyEntry = (history, fields) => ({
  id: String(history.length + 1),
  ...fields,
  created_at: new Date().toISOString(),
});

const newOrderCode = () => `ORD-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

export class OrderRepository {
  constructor(db = pool) {
    this.db = db;
  }

  // --- CHK01: Báo giá ---

  calculateQuote(userId, body, client = this.db) {
    return calculateQuote(client, userId, body);
  }

  // --- CHK02: Tạo đơn hàng từ báo giá ---

  async createOrderFromQuote(userId, { idempotency_key, ...request }) {
    const order = await withTransaction(this.db, (tx) => withIdempotency(tx, {
      actorId: userId, key: idempotency_key, operation: 'order:create', payload: request,
    }, () => this.insertOrder(userId, request, tx)));
    forgetQuote(request.quote_id);
    return order;
  }

  async insertOrder(userId, { quote_id, note: overrideNote, quote_data }, client) {
    let quote = null;
    if (quote_id) {
      // Khóa theo quote để hai request đồng thời không tạo hai đơn từ cùng một báo giá
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['quote:' + quote_id]);
      quote = findQuote(quote_id);
      if (!quote || quote.user_id !== userId || new Date(quote.expires_at) <= new Date()) {
        throw new BadRequestError('Báo giá không hợp lệ hoặc đã hết hạn');
      }
    }
    // Không gửi quote_id: tính báo giá mới ngay từ dữ liệu request (hoặc từ giỏ hàng)
    if (!quote?.items?.length) quote = await calculateQuote(client, userId, quote_data || {});

    const note = overrideNote !== undefined ? overrideNote : (quote.note || '');
    const history = [{
      id: '1',
      status: 'pending',
      label: 'Đặt hàng thành công',
      note: note || 'Khách hàng tạo đơn qua hệ thống',
      created_at: new Date().toISOString(),
    }];

    const { rows } = await client.query(`
      INSERT INTO orders (
        code, user_id, status, status_label, payment_status, deposit_status,
        payment_method, payment_mode, delivery_method, subtotal, shipping_fee,
        discount_amount, total_amount, deposit_rate, deposit_amount, amount_due_now,
        paid_amount, refunded_amount, held_amount, remaining_amount, currency,
        recipient, shipment, history, note, coupon
      )
      VALUES (
        $1, $2, 'pending', $3, 'unpaid', CASE WHEN $5 = 'deposit' THEN 'unpaid' ELSE 'none' END,
        $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        0, 0, 0, $10, 'VND',
        $14, $15, $16, $17, $18
      )
      RETURNING id, code, status, status_label, payment_status, deposit_status,
                deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount,
                held_amount, remaining_amount, created_at, updated_at, payment_method,
                payment_mode, delivery_method, amount_due_now, currency;
    `, [
      newOrderCode(),
      userId,
      ORDER_STATUS_LABELS.pending,
      quote.payment_method,
      quote.payment_mode,
      quote.delivery_method,
      quote.subtotal,
      quote.shipping_fee,
      quote.discount_amount,
      quote.total_amount,
      quote.deposit_rate,
      quote.deposit_amount,
      quote.amount_due_now,
      JSON.stringify(quote.recipient || {}),
      JSON.stringify({ carrier: '', tracking_number: '', shipped_at: null, delivered_at: null }),
      JSON.stringify(history),
      note,
      JSON.stringify(quote.coupon || {}),
    ]);
    const order = rows[0];

    // Khóa sản phẩm theo thứ tự product_id cố định để tránh deadlock giữa các đơn đồng thời
    const items = [...quote.items].sort((a, b) => a.product_id.localeCompare(b.product_id));
    for (const item of items) {
      await client.query(`
        INSERT INTO order_items (
          order_id, product_id, variant_id, product_name, variant_label,
          color, image_url, unit_price, quantity, line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
      `, [
        order.id,
        item.product_id,
        item.variant_id || 'default',
        item.product_name,
        item.variant_label || 'Mặc định',
        item.color || '',
        item.image_url || '',
        item.unit_price,
        item.quantity,
        item.line_total,
      ]);
      await this.takeStock(client, item);
    }

    if (quote.coupon?.id) await voucherRepository.consume(quote.coupon.id, userId, client);
    if (quote.removed_cart_item_ids?.length) {
      await cartRepository.removeItemsByIds(userId, quote.removed_cart_item_ids, client);
    }

    return {
      ...withNumericAmounts(order),
      removed_cart_item_ids: quote.removed_cart_item_ids || [],
    };
  }

  // Trừ tồn kho của biến thể đã đặt
  async takeStock(client, item) {
    const product = await lockProduct(client, item.product_id);
    if (!product) return;
    if (!product.active) throw new ConflictError('Sản phẩm đã ngừng bán');
    const stock = currentStock(product, item.variant_id);
    const quantity = Number(item.quantity);
    if (stock < quantity) throw new ConflictError(`Sản phẩm ${item.product_name} không còn đủ tồn kho`);
    await saveStock(client, product, item.variant_id, stock - quantity);
  }

  // Đơn bị hủy: hủy phiên thanh toán đang chờ và trả hàng về kho
  async releaseCancelledOrder(orderId, client) {
    await client.query(
      "UPDATE payment_sessions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 AND status = 'pending'",
      [orderId],
    );
    const { rows: items } = await client.query(
      'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = $1;',
      [orderId],
    );
    for (const item of items) {
      const product = await lockProduct(client, item.product_id);
      if (product) {
        await saveStock(client, product, item.variant_id, currentStock(product, item.variant_id) + Number(item.quantity));
      }
    }
  }

  // --- ORD01: Danh sách đơn hàng của khách ---

  async getUserOrders(userId, { status, page = 1, limit = 20 } = {}, client = this.db) {
    const values = [userId];
    let where = 'WHERE o.user_id = $1';
    if (status?.trim()) {
      values.push(status.trim());
      where += ` AND o.status = $${values.length}`;
    }

    const { rows: countRows } = await client.query(`SELECT COUNT(*)::int AS total FROM orders o ${where};`, values);
    const total = countRows[0]?.total || 0;
    const { pageNum, limitNum, offset } = pagination(page, limit);

    const { rows } = await client.query(`
      SELECT ${LIST_COLUMNS}, ${ORDER_ITEMS_JSON}
      FROM orders o
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2};
    `, [...values, limitNum, offset]);

    const orders = rows.map((row) => {
      const order = mapOrder(row, Array.isArray(row.items) ? row.items : []);
      return {
        ...order,
        note: row.note || '',
        item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items_preview: order.items.slice(0, 3).map(({ product_name, variant_label, image_url, quantity }) =>
          ({ product_name, variant_label, image_url, quantity })),
        allowed_actions: canCustomerCancel(row) ? ['cancel'] : [],
      };
    });

    return { orders, pagination: paginationResult(pageNum, limitNum, total) };
  }

  // --- ORD02: Chi tiết đơn hàng của khách ---

  async getUserOrderDetail(userId, orderId, client = this.db) {
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1;', [orderId, userId]);
    const row = rows[0];
    if (!row) return null;
    return {
      ...mapOrder(row, await loadItems(client, orderId)),
      allowed_actions: canCustomerCancel(row) ? ['cancel'] : [],
    };
  }

  // --- ORD03: Khách hủy đơn ---

  cancelOrder(userId, orderId, reason = '') {
    return withTransaction(this.db, async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE;', [orderId, userId]);
      const order = rows[0];
      if (!order) throw new NotFoundError('Không tìm thấy đơn hàng');
      if (!canCustomerCancel(order)) {
        throw new BadRequestError(`Không thể hủy đơn hàng ở trạng thái "${statusLabel(order)}"`);
      }

      const history = parseJsonArray(order.history);
      history.push(historyEntry(history, {
        status: 'cancelled',
        label: 'Khách hàng hủy đơn',
        note: reason || 'Khách yêu cầu hủy đơn',
      }));

      const { rows: updated } = await client.query(`
        UPDATE orders
        SET status = 'cancelled', status_label = $1, history = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, code, status, status_label, payment_status, deposit_status,
                  deposit_paid_at, total_amount, deposit_amount, paid_amount,
                  refunded_amount, held_amount, remaining_amount, created_at, updated_at;
      `, [ORDER_STATUS_LABELS.cancelled, JSON.stringify(history), orderId]);
      await this.releaseCancelledOrder(orderId, client);

      return { ...withNumericAmounts(updated[0]), allowed_actions: [] };
    });
  }

  // --- ADO01: Danh sách đơn hàng quản trị ---

  async getAdminOrders({ keyword = '', status = '', payment_status = '', view = '', page = 1, limit = 20 } = {}, client = this.db) {
    const conditions = [];
    const values = [];
    if (keyword?.trim()) {
      values.push(`%${keyword.trim().toLowerCase()}%`);
      const p = `$${values.length}`;
      conditions.push(`(LOWER(o.code) LIKE ${p} OR LOWER(u.name) LIKE ${p} OR LOWER(u.email) LIKE ${p} OR LOWER(o.recipient->>'name') LIKE ${p})`);
    }
    if (status?.trim()) {
      values.push(status.trim());
      conditions.push(`o.status = $${values.length}`);
    }
    if (payment_status?.trim()) {
      values.push(payment_status.trim());
      conditions.push(`o.payment_status = $${values.length}`);
    }
    // Màn thanh toán chỉ cần các đơn đã phát sinh tiền
    if (view === 'payments') conditions.push(`(o.paid_amount > 0 OR o.payment_status != 'unpaid')`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM orders o LEFT JOIN users u ON o.user_id = u.id ${where};`,
      values,
    );
    const total = countRows[0]?.total || 0;
    const { pageNum, limitNum, offset } = pagination(page, limit);

    const { rows } = await client.query(`
      SELECT ${LIST_COLUMNS}, o.completed_at,
             (SELECT pc.note FROM payment_confirmations pc
              WHERE pc.order_id = o.id ORDER BY pc.confirmed_at DESC LIMIT 1) AS payment_note,
             ${CUSTOMER_COLUMNS},
             ${ORDER_ITEMS_JSON}
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2};
    `, [...values, limitNum, offset]);

    const orders = rows.map((row) => {
      const recipient = asObject(row.recipient);
      return {
        ...mapOrder(row, Array.isArray(row.items) ? row.items : []),
        completed_at: row.completed_at,
        customer: mapCustomer(row),
        recipient_name: recipient.name || row.user_name || 'Khách nhận',
        allowed_next_statuses: allowedNextStatuses(row),
        note: row.note || '',
        payment_note: row.payment_note || '',
        allowed_actions: hasAdminWorkflow(row) ? ['update_status'] : [],
      };
    });

    return { orders, pagination: paginationResult(pageNum, limitNum, total) };
  }

  // Chỉ xóa được đơn đã hủy và chưa phát sinh tiền; trả về danh sách thành công/thất bại theo từng id
  async bulkDeleteAdminOrders(ids = [], client = this.db) {
    const deleted_ids = [];
    const failed = [];

    for (const id of new Set(ids)) {
      const { rows } = await client.query(
        'SELECT id, status, paid_amount, refunded_amount FROM orders WHERE id = $1 LIMIT 1;',
        [id],
      );
      const order = rows[0];
      if (!order) {
        failed.push({ id, code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng' });
        continue;
      }
      if (order.status !== 'cancelled' || Number(order.paid_amount || 0) > 0 || Number(order.refunded_amount || 0) > 0) {
        failed.push({ id, code: 'ORDER_NOT_DELETABLE', message: 'Chỉ được xóa đơn đã hủy và chưa phát sinh thanh toán' });
        continue;
      }

      await client.query('DELETE FROM payments WHERE order_id = $1;', [id]);
      const deleted = await client.query(
        `DELETE FROM orders
         WHERE id = $1 AND status = 'cancelled'
           AND COALESCE(paid_amount, 0) = 0 AND COALESCE(refunded_amount, 0) = 0
         RETURNING id;`,
        [id],
      );
      if (deleted.rows[0]) deleted_ids.push(id);
      else failed.push({ id, code: 'DELETE_FAILED', message: 'Không thể xóa đơn hàng' });
    }

    return { deleted_ids, failed };
  }

  // --- ADO02: Chi tiết đơn hàng quản trị ---

  async getAdminOrderDetail(orderId, client = this.db) {
    const { rows } = await client.query(
      `SELECT o.*, ${CUSTOMER_COLUMNS} FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = $1 LIMIT 1;`,
      [orderId],
    );
    const row = rows[0];
    if (!row) return null;

    const { rows: notes } = await client.query(
      'SELECT note FROM payment_confirmations WHERE order_id = $1 ORDER BY confirmed_at DESC LIMIT 1;',
      [orderId],
    );
    const allowedNext = allowedNextStatuses(row);

    return {
      ...mapOrder(row, await loadItems(client, orderId)),
      customer: mapCustomer(row),
      note: row.note || '',
      payment_note: notes[0]?.note || '',
      allowed_next_statuses: allowedNext,
      allowed_actions: allowedNext.length > 0 ? ['change_status', 'update_shipment'] : [],
      completed_at: row.completed_at,
    };
  }

  // --- ADO03: Cập nhật trạng thái, vận đơn, ghi chú ---

  updateAdminOrder(orderId, { status, carrier, tracking_number, note, expected_updated_at }, actorName = 'Quản trị viên') {
    return withTransaction(this.db, async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE;', [orderId]);
      const order = rows[0];
      if (!order) throw new NotFoundError('Không tìm thấy đơn hàng');
      // Chống ghi đè: FE gửi updated_at đã đọc, đơn đã đổi từ lúc đó thì từ chối
      if (expected_updated_at && new Date(expected_updated_at).getTime() !== new Date(order.updated_at).getTime()) {
        throw new ConflictError('Đơn hàng vừa được cập nhật bởi người khác, vui lòng tải lại');
      }

      const newStatus = status || order.status;
      const statusChanged = newStatus !== order.status;
      if (statusChanged && !allowedNextStatuses(order).some((item) => item.code === newStatus)) {
        throw new BadRequestError('Trạng thái đơn hàng không thể chuyển theo quy trình hiện tại');
      }
      if (statusChanged && ['cancelled', 'returned'].includes(newStatus) && !String(note || '').trim()) {
        throw new BadRequestError('Vui lòng nhập lý do hủy đơn hoặc hoàn hàng');
      }
      if (statusChanged && newStatus === 'completed' && Number(order.paid_amount || 0) < Number(order.total_amount)) {
        throw new BadRequestError('Cần xác nhận đủ thanh toán trước khi hoàn thành');
      }

      const shipment = this.nextShipment(order, newStatus, { carrier, tracking_number });
      const newStatusLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;
      const history = parseJsonArray(order.history);
      if (statusChanged || note) {
        history.push(historyEntry(history, {
          status: newStatus,
          label: newStatusLabel,
          note: note || `Cập nhật sang ${newStatusLabel}`,
          actor_name: actorName,
        }));
      }
      const completedAt = newStatus !== 'completed' ? null : (order.completed_at || new Date().toISOString());
      const nextNote = note === undefined ? (order.note || '') : String(note);

      const { rows: updatedRows } = await client.query(`
        UPDATE orders
        SET status = $1, status_label = $2, shipment = $3, history = $4,
            completed_at = $5, note = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, code, status, status_label, payment_status, deposit_status,
                  deposit_paid_at, total_amount, deposit_amount, paid_amount,
                  refunded_amount, held_amount, remaining_amount, created_at,
                  updated_at, shipment, completed_at;
      `, [newStatus, newStatusLabel, JSON.stringify(shipment), JSON.stringify(history), completedAt, nextNote, orderId]);

      if (newStatus === 'cancelled' && order.status !== 'cancelled') {
        await this.releaseCancelledOrder(orderId, client);
      }
      // Ghi chú đơn cũng là ghi chú của lần xác nhận thanh toán gần nhất (màn Thanh toán dùng chung)
      if (note !== undefined) {
        await client.query(
          `UPDATE payment_confirmations SET note = $1
           WHERE id = (SELECT id FROM payment_confirmations WHERE order_id = $2 ORDER BY confirmed_at DESC LIMIT 1);`,
          [nextNote, orderId],
        );
      }

      const updated = updatedRows[0];
      const allowedNext = allowedNextStatuses(updated);
      return {
        ...withNumericAmounts(updated),
        shipment,
        allowed_next_statuses: allowedNext,
        allowed_actions: allowedNext.length > 0 ? ['change_status', 'update_shipment'] : [],
      };
    });
  }

  // Vận đơn sau khi cập nhật: kiểm tra mã vận đơn và ghi mốc giao/nhận hàng
  nextShipment(order, newStatus, { carrier, tracking_number }) {
    const shipment = { ...asObject(order.shipment) };
    const hasShipmentInput = (carrier !== undefined && String(carrier).trim()) ||
      (tracking_number !== undefined && String(tracking_number).trim());
    if (['cancelled', 'returned', 'refunded'].includes(newStatus) && hasShipmentInput) {
      throw new BadRequestError('Đơn đã hủy hoặc hoàn tiền không được cập nhật vận đơn');
    }
    if (carrier !== undefined) shipment.carrier = carrier;
    if (tracking_number !== undefined) shipment.tracking_number = tracking_number;

    if (newStatus === 'shipping') {
      if (!String(shipment.carrier || '').trim() || !String(shipment.tracking_number || '').trim()) {
        throw new BadRequestError('Đơn đang giao cần có đơn vị vận chuyển và mã vận đơn');
      }
      shipment.shipped_at ||= new Date().toISOString();
    }
    if (['delivered', 'completed'].includes(newStatus)) shipment.delivered_at ||= new Date().toISOString();
    return shipment;
  }

  // --- DSH01: Số liệu tổng quan ---

  async getDashboardSummary({ from, to, timezone = 'Asia/Ho_Chi_Minh' } = {}, client = this.db) {
    const count = async (sql) => (await client.query(sql)).rows[0]?.count || 0;
    const sum = async (sql) => Number((await client.query(sql)).rows[0]?.total || 0);

    // Doanh thu chỉ tính đơn đã hoàn thành
    const revenue = await sum(`SELECT COALESCE(SUM(paid_amount), 0)::numeric AS total FROM orders WHERE status = 'completed';`);
    const todayRevenue = await sum(`
      SELECT COALESCE(SUM(paid_amount), 0)::numeric AS total FROM orders
      WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE;`);
    const orderCount = await count('SELECT COUNT(*)::int AS count FROM orders;');
    const pendingCount = await count(`SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending';`);
    const lowStockCount = await count(`SELECT COUNT(*)::int AS count FROM products WHERE stock <= ${LOW_STOCK_THRESHOLD};`);

    const { rows: statusRows } = await client.query('SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status;');
    const statusCounts = Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => ({
      status,
      label,
      count: statusRows.find((row) => row.status === status)?.count || 0,
    }));

    const { rows: recentRows } = await client.query(`
      SELECT o.id, o.code, o.total_amount, o.status, o.created_at,
             u.name AS customer_name, o.recipient->>'name' AS recipient_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 5;
    `);

    return {
      revenue,
      today_revenue: todayRevenue,
      order_count: orderCount,
      pending_order_count: pendingCount,
      low_stock_count: lowStockCount,
      low_stock_threshold: LOW_STOCK_THRESHOLD,
      status_counts: statusCounts,
      recent_orders: recentRows.map((row) => ({
        id: row.id,
        code: row.code,
        customer_name: row.customer_name || row.recipient_name || 'Khách hàng',
        total_amount: Number(row.total_amount),
        status: row.status,
        created_at: row.created_at,
      })),
      period: {
        from: from || new Date(new Date().getFullYear(), 0, 1).toISOString(),
        to: to || new Date().toISOString(),
        timezone,
        revenue_date_basis: 'completed_at',
      },
    };
  }

  // --- REP01: Báo cáo bán hàng theo 12 tháng của một năm ---

  async getSalesReport({ year, from, to, group_by = 'month', timezone = 'Asia/Ho_Chi_Minh', date_basis = 'created_at' } = {}, client = this.db) {
    const selectedYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const totals = `
      COUNT(*)::int AS order_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_order_count,
      COALESCE(SUM(paid_amount), 0)::numeric AS revenue,
      COALESCE(SUM(held_amount), 0)::numeric AS held_amount,
      COALESCE(SUM(refunded_amount), 0)::numeric AS refunded_amount`;
    const toTotals = (row) => ({
      order_count: row?.order_count || 0,
      completed_order_count: row?.completed_order_count || 0,
      revenue: Number(row?.revenue || 0),
      held_amount: Number(row?.held_amount || 0),
      refunded_amount: Number(row?.refunded_amount || 0),
    });

    const { rows: summaryRows } = await client.query(
      `SELECT ${totals} FROM orders WHERE EXTRACT(YEAR FROM created_at) = $1;`,
      [selectedYear],
    );
    const { rows: monthRows } = await client.query(`
      SELECT EXTRACT(MONTH FROM created_at)::int AS month, ${totals}
      FROM orders
      WHERE EXTRACT(YEAR FROM created_at) = $1
      GROUP BY EXTRACT(MONTH FROM created_at);
    `, [selectedYear]);

    const rows = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return {
        period_start: new Date(selectedYear, month - 1, 1).toISOString(),
        period_end: new Date(selectedYear, month, 0, 23, 59, 59).toISOString(),
        label: `Tháng ${month}`,
        ...toTotals(monthRows.find((row) => row.month === month)),
      };
    });

    return {
      summary: toTotals(summaryRows[0]),
      rows,
      period: {
        from: from || new Date(selectedYear, 0, 1).toISOString(),
        to: to || new Date(selectedYear, 11, 31, 23, 59, 59).toISOString(),
        timezone,
        date_basis,
        group_by,
      },
    };
  }
}

export const orderRepository = new OrderRepository();
export default orderRepository;
