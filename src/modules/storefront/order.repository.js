import pool from '../../config/db.js';
import cartRepository from './cart.repository.js';
import { LOW_STOCK_THRESHOLD } from './inventory.repository.js';
import { findProvinceByCode, findWardByCode } from '../../constants/locations.js';
import { voucherRepository } from './voucher.repository.js';

// Lưu quote tạm thời trong bộ nhớ cache
const quotesCache = new Map();

export const ORDER_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao hàng',
  delivered: 'Giao thành công',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
};

export const NEXT_STATUS_MAP = {
  pending: [
    { code: 'confirmed', label: 'Xác nhận đơn' },
    { code: 'cancelled', label: 'Hủy đơn' },
  ],
  confirmed: [
    { code: 'processing', label: 'Đóng gói đơn' },
    { code: 'shipping', label: 'Giao hàng' },
    { code: 'cancelled', label: 'Hủy đơn' },
  ],
  shipping: [
    { code: 'delivered', label: 'Giao thành công' },
    { code: 'cancelled', label: 'Giao thất bại / Hủy' },
  ],
  processing: [
    { code: 'shipping', label: 'Giao hàng' },
    { code: 'delivered', label: 'Giao thành công' },
  ],
  delivered: [{ code: 'completed', label: 'Hoàn thành' }],
  completed: [],
  cancelled: [],
  refunded: [],
};

export class OrderRepository {
  constructor(db = pool) {
    this.db = db;
  }

  // --- CHK01: Báo giá (Quote) ---

  async calculateQuote(userId, {
    cart_item_ids,
    items: directItems,
    address_id,
    recipient: directRecipient,
    delivery_method = 'standard',
    coupon_code,
    payment_method = 'cod',
    payment_mode = 'full',
    deposit_rate: requestedDepositRate,
    note = '',
  }, client = this.db) {
    let resolvedItems = [];
    let removedCartItemIds = [];

    if (Array.isArray(cart_item_ids) && cart_item_ids.length > 0) {
      const cart = await cartRepository.getCart(userId, client);
      resolvedItems = cart.items.filter((item) => cart_item_ids.includes(item.id));
      removedCartItemIds = cart_item_ids;
    } else if (Array.isArray(directItems) && directItems.length > 0) {
      for (const item of directItems) {
        const pRes = await client.query(`SELECT id, name, price, stock, variants, image, active FROM products WHERE id = $1;`, [item.product_id]);
        if (pRes.rows[0]) {
          const prod = pRes.rows[0];
          let parsedVariants = Array.isArray(prod.variants) ? prod.variants : [];
          if (typeof prod.variants === 'string') {
            try { parsedVariants = JSON.parse(prod.variants); } catch {}
          }
          const matched = parsedVariants.find((v) => String(v.id) === String(item.variant_id)) || parsedVariants[0];
          const unitPrice = matched?.price !== undefined ? Number(matched.price) : Number(prod.price);
          const stockQty = matched?.stock_quantity !== undefined ? Number(matched.stock_quantity) : Number(prod.stock);
          const qty = Number(item.quantity) || 1;

          resolvedItems.push({
            product_id: prod.id,
            variant_id: matched?.id ? String(matched.id) : (item.variant_id || 'default'),
            product_name: prod.name,
            variant_label: matched?.label || matched?.name || 'Mặc định',
            color: matched?.color || '',
            image_url: matched?.image || prod.image || '',
            unit_price: unitPrice,
            quantity: qty,
            line_total: unitPrice * qty,
            stock_quantity: stockQty,
            is_available: Boolean(prod.active) && stockQty >= qty,
          });
        }
      }
    } else {
      // Mặc định lấy toàn bộ giỏ hàng
      const cart = await cartRepository.getCart(userId, client);
      resolvedItems = cart.items;
      removedCartItemIds = cart.items.map((i) => i.id);
    }

    if (resolvedItems.length === 0) {
      const err = new Error('Không có sản phẩm nào được chọn để báo giá');
      err.statusCode = 400;
      throw err;
    }

    // Địa chỉ nhận hàng
    let recipient = { name: '', phone: '', full_address: '' };
    if (address_id) {
      const addrRes = await client.query(
        `SELECT recipient_name, recipient_phone, full_address, street_address, province_name, ward_name
         FROM user_addresses
         WHERE id = $1 AND user_id = $2;`,
        [address_id, userId],
      );
      if (!addrRes.rows[0]) {
        const error = new Error('Địa chỉ nhận hàng không hợp lệ');
        error.statusCode = 400;
        throw error;
      }
      const a = addrRes.rows[0];
      recipient = {
        name: a.recipient_name,
        phone: a.recipient_phone,
        full_address: a.full_address || `${a.street_address}, ${a.ward_name}, ${a.province_name}`,
      };
    } else if (directRecipient) {
      const prov = findProvinceByCode(directRecipient.province_code);
      const ward = findWardByCode(directRecipient.ward_code);
      recipient = {
        name: directRecipient.name || '',
        phone: directRecipient.phone || '',
        full_address: directRecipient.full_address || `${directRecipient.street_address || ''}, ${ward?.name || ''}, ${prov?.name || ''}`,
      };
    } else {
      // Tìm địa chỉ mặc định của user
      const defAddrRes = await client.query(`
        SELECT recipient_name, recipient_phone, full_address, street_address, province_name, ward_name
        FROM user_addresses WHERE user_id = $1 AND is_default = TRUE LIMIT 1;
      `, [userId]);
      if (defAddrRes.rows[0]) {
        const a = defAddrRes.rows[0];
        recipient = {
          name: a.recipient_name,
          phone: a.recipient_phone,
          full_address: a.full_address || `${a.street_address}, ${a.ward_name}, ${a.province_name}`,
        };
      }
    }

    const subtotal = resolvedItems.reduce((sum, item) => sum + item.line_total, 0);

    // Tính phí vận chuyển (nếu delivery_method là pickup thì 0, nếu >= 500,000 thì freeship, ngược lại 30,000)
    let shippingFee = 30000;
    if (delivery_method === 'pickup' || subtotal >= 500000) {
      shippingFee = 0;
    }

    // Tính giảm giá voucher từ dữ liệu quản trị.
    let discountAmount = 0;
    let couponResult = null;
    if (coupon_code) {
      couponResult = await voucherRepository.calculateDiscount(coupon_code, {
        subtotal,
        shippingFee,
      }, client);
      discountAmount = couponResult.discount_amount;
    }

    const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

    // Tính cọc (mặc định 20% hoặc theo yêu cầu [20, 50, 70])
    let depositRate = requestedDepositRate !== undefined ? Number(requestedDepositRate) : 20;
    if (![20, 50, 70].includes(depositRate)) {
      depositRate = 20;
    }
    const depositAmount = Math.round((totalAmount * depositRate) / 100);

    const amountDueNow = payment_mode === 'deposit' ? depositAmount : totalAmount;

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const quoteData = {
      quote_id: quoteId,
      expires_at: expiresAt,
      items: resolvedItems,
      recipient,
      delivery_method,
      coupon: couponResult,
      allowed_payment_methods: ['cod', 'bank_transfer', 'qr', 'card'],
      allowed_deposit_rates: [20, 50, 70],
      subtotal,
      shipping_fee: shippingFee,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      deposit_rate: depositRate,
      deposit_amount: depositAmount,
      amount_due_now: amountDueNow,
      paid_amount: 0,
      refunded_amount: 0,
      held_amount: 0,
      remaining_amount: totalAmount,
      currency: 'VND',
      payment_method,
      payment_mode,
      note,
      removed_cart_item_ids: removedCartItemIds,
      user_id: userId,
    };

    quotesCache.set(quoteId, quoteData);

    return quoteData;
  }

  // --- CHK02: Tạo đơn hàng từ báo giá ---

  async createOrderFromQuote(userId, payload, client = this.db) {
    // Đơn hàng, tồn kho, giỏ hàng và lượt dùng voucher phải cùng một giao dịch.
    // Nếu một bước thất bại, không để lại đơn dang dở hoặc trừ voucher một phần.
    if (client === this.db && typeof this.db.connect === 'function') {
      const transactionClient = await this.db.connect();
      try {
        await transactionClient.query('BEGIN');
        const result = await this.createOrderFromQuote(userId, payload, transactionClient);
        await transactionClient.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await transactionClient.query('ROLLBACK');
        } catch {
          // Giữ lại lỗi nghiệp vụ ban đầu để middleware trả về đúng mã lỗi.
        }
        throw error;
      } finally {
        transactionClient.release();
      }
    }

    return this._createOrderFromQuote(userId, payload, client);
  }

  async _createOrderFromQuote(userId, { quote_id, note: overrideNote, quote_data }, client) {
    let quote = quote_id ? quotesCache.get(quote_id) : null;

    if (!quote || !quote.items || quote.items.length === 0) {
      // Tự tính quote mới từ payload hoặc giỏ hàng
      quote = await this.calculateQuote(userId, quote_data || {}, client);
    }

    const note = overrideNote !== undefined ? overrideNote : (quote.note || '');
    const orderCode = `ORD-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const initialHistory = [
      {
        id: '1',
        status: 'pending',
        label: 'Đặt hàng thành công',
        note: note || 'Khách hàng tạo đơn qua hệ thống',
        created_at: new Date().toISOString(),
      },
    ];

    // Tạo đơn trong bảng orders
    const orderQuery = `
      INSERT INTO orders (
        code, user_id, status, status_label, payment_status, deposit_status,
        payment_method, payment_mode, delivery_method, subtotal, shipping_fee,
        discount_amount, total_amount, deposit_rate, deposit_amount, amount_due_now,
        paid_amount, refunded_amount, held_amount, remaining_amount, currency,
        recipient, shipment, history, note, coupon
      )
      VALUES (
        $1, $2, 'pending', $3, 'unpaid', 'none',
        $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        0, 0, 0, $14, 'VND',
        $15, $16, $17, $18, $19
      )
      RETURNING id, code, status, status_label, payment_status, deposit_status,
                deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount,
                held_amount, remaining_amount, created_at, updated_at, payment_method,
                payment_mode, delivery_method, amount_due_now, currency;
    `;

    const values = [
      orderCode,
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
      quote.total_amount,
      JSON.stringify(quote.recipient || {}),
      JSON.stringify({ carrier: '', tracking_number: '', shipped_at: null, delivered_at: null }),
      JSON.stringify(initialHistory),
      note,
      JSON.stringify(quote.coupon || {}),
    ];

    const orderRes = await client.query(orderQuery, values);
    const order = orderRes.rows[0];

    // Tạo các dòng order_items và trừ kho
    for (const item of quote.items) {
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

      // Trừ tồn kho theo biến thể và đồng bộ tổng tồn kho sản phẩm.
      const productRes = await client.query(
        `SELECT stock, variants FROM products WHERE id = $1 FOR UPDATE;`,
        [item.product_id],
      );
      if (productRes.rows[0]) {
        const product = productRes.rows[0];
        let variants = Array.isArray(product.variants) ? product.variants : [];
        if (typeof product.variants === 'string') {
          try { variants = JSON.parse(product.variants); } catch { variants = []; }
        }
        const variantIndex = variants.findIndex(
          (variant) => String(variant.id) === String(item.variant_id),
        );
        if (variantIndex >= 0) {
          const variant = variants[variantIndex];
          const before = Number(variant.stock_quantity ?? variant.stock ?? 0);
          const quantity = Number(item.quantity);
          if (before < quantity) {
            const error = new Error(`Sản phẩm ${item.product_name} không còn đủ tồn kho`);
            error.statusCode = 409;
            error.code = 'INSUFFICIENT_STOCK';
            throw error;
          }
          const after = before - quantity;
          variants[variantIndex] = {
            ...variant,
            stock_quantity: after,
            stock: after,
          };
          const totalStock = variants.reduce(
            (sum, entry) => sum + Number(entry.stock_quantity ?? entry.stock ?? 0),
            0,
          );
          await client.query(
            `UPDATE products SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3;`,
            [totalStock, JSON.stringify(variants), item.product_id],
          );
        } else {
          if (Number(product.stock) < Number(item.quantity)) {
            const error = new Error(`Sản phẩm ${item.product_name} không còn đủ tồn kho`);
            error.statusCode = 409;
            error.code = 'INSUFFICIENT_STOCK';
            throw error;
          }
          await client.query(
            `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
            [item.quantity, item.product_id],
          );
        }
      }
    }

    if (quote.coupon?.id) {
      await voucherRepository.consume(quote.coupon.id, client);
    }

    // Xóa các dòng đã đặt khỏi giỏ hàng
    if (quote.removed_cart_item_ids && quote.removed_cart_item_ids.length > 0) {
      await cartRepository.removeItemsByIds(userId, quote.removed_cart_item_ids, client);
    }

    quotesCache.delete(quote_id);

    return {
      ...order,
      total_amount: Number(order.total_amount),
      deposit_amount: Number(order.deposit_amount),
      paid_amount: Number(order.paid_amount),
      refunded_amount: Number(order.refunded_amount),
      held_amount: Number(order.held_amount),
      remaining_amount: Number(order.remaining_amount),
      amount_due_now: Number(order.amount_due_now),
      removed_cart_item_ids: quote.removed_cart_item_ids || [],
    };
  }

  // --- ORD01: Danh sách đơn hàng của khách ---

  async getUserOrders(userId, { status, page = 1, limit = 20 } = {}, client = this.db) {
    const conditions = ['user_id = $1'];
    const values = [userId];

    if (status && status.trim()) {
      values.push(status.trim());
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `SELECT COUNT(*)::int AS total FROM orders ${whereClause};`;
    const countRes = await client.query(countQuery, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    values.push(limitNum);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const dataQuery = `
      SELECT id, code, status, status_label, payment_status, deposit_status,
             deposit_paid_at, total_amount, deposit_amount, paid_amount,
             refunded_amount, held_amount, remaining_amount, created_at, updated_at
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;
    const dataRes = await client.query(dataQuery, values);

    const orders = [];
    for (const row of dataRes.rows) {
      const itemsRes = await client.query(`
        SELECT product_name, variant_label, image_url, quantity
        FROM order_items
        WHERE order_id = $1
        LIMIT 3;
      `, [row.id]);

      const countItemRes = await client.query(`
        SELECT COALESCE(SUM(quantity), 0)::int AS count
        FROM order_items
        WHERE order_id = $1;
      `, [row.id]);

      const allowedActions = [];
      if (['pending', 'confirmed'].includes(row.status)) {
        allowedActions.push('cancel');
      }

      orders.push({
        id: row.id,
        code: row.code,
        status: row.status,
        status_label: row.status_label || ORDER_STATUS_LABELS[row.status] || row.status,
        payment_status: row.payment_status,
        deposit_status: row.deposit_status,
        deposit_paid_at: row.deposit_paid_at,
        total_amount: Number(row.total_amount),
        deposit_amount: Number(row.deposit_amount),
        paid_amount: Number(row.paid_amount),
        refunded_amount: Number(row.refunded_amount),
        held_amount: Number(row.held_amount),
        remaining_amount: Number(row.remaining_amount),
        created_at: row.created_at,
        updated_at: row.updated_at,
        item_count: countItemRes.rows[0]?.count || 0,
        items_preview: itemsRes.rows,
        allowed_actions: allowedActions,
      });
    }

    return {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  // --- ORD02: Chi tiết đơn hàng của khách ---

  async getUserOrderDetail(userId, orderId, client = this.db) {
    const query = `
      SELECT * FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1;
    `;
    const result = await client.query(query, [orderId, userId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    const itemsRes = await client.query(`
      SELECT product_id, variant_id, product_name, variant_label, color,
             image_url, unit_price, quantity, line_total
      FROM order_items
      WHERE order_id = $1;
    `, [orderId]);

    const allowedActions = [];
    if (['pending', 'confirmed'].includes(row.status)) {
      allowedActions.push('cancel');
    }

    let parsedRecipient = typeof row.recipient === 'object' ? row.recipient : {};
    let parsedShipment = typeof row.shipment === 'object' ? row.shipment : {};
    let parsedHistory = Array.isArray(row.history) ? row.history : [];

    return {
      id: row.id,
      code: row.code,
      status: row.status,
      status_label: row.status_label || ORDER_STATUS_LABELS[row.status] || row.status,
      payment_status: row.payment_status,
      deposit_status: row.deposit_status,
      deposit_paid_at: row.deposit_paid_at,
      payment_method: row.payment_method,
      payment_mode: row.payment_mode,
      delivery_method: row.delivery_method,
      subtotal: Number(row.subtotal),
      shipping_fee: Number(row.shipping_fee),
      discount_amount: Number(row.discount_amount),
      total_amount: Number(row.total_amount),
      deposit_rate: Number(row.deposit_rate),
      deposit_amount: Number(row.deposit_amount),
      amount_due_now: Number(row.amount_due_now),
      paid_amount: Number(row.paid_amount),
      refunded_amount: Number(row.refunded_amount),
      held_amount: Number(row.held_amount),
      remaining_amount: Number(row.remaining_amount),
      currency: row.currency || 'VND',
      recipient: parsedRecipient,
      items: itemsRes.rows.map((i) => ({
        ...i,
        unit_price: Number(i.unit_price),
        line_total: Number(i.line_total),
      })),
      shipment: parsedShipment,
      history: parsedHistory,
      allowed_actions: allowedActions,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // --- ORD03: Hủy đơn hàng ---

  async cancelOrder(userId, orderId, reason = '', client = this.db) {
    const existing = await client.query(`
      SELECT * FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1;
    `, [orderId, userId]);
    if (existing.rows.length === 0) {
      const err = new Error('Không tìm thấy đơn hàng');
      err.statusCode = 404;
      throw err;
    }

    const order = existing.rows[0];
    if (!['pending', 'confirmed'].includes(order.status)) {
      const err = new Error(`Không thể hủy đơn hàng ở trạng thái "${order.status_label || order.status}"`);
      err.statusCode = 400;
      throw err;
    }

    let parsedHistory = Array.isArray(order.history) ? order.history : [];
    if (typeof order.history === 'string') {
      try { parsedHistory = JSON.parse(order.history); } catch {}
    }

    parsedHistory.push({
      id: String(parsedHistory.length + 1),
      status: 'cancelled',
      label: 'Khách hàng hủy đơn',
      note: reason || 'Khách yêu cầu hủy đơn',
      created_at: new Date().toISOString(),
    });

    const updateQuery = `
      UPDATE orders
      SET status = 'cancelled',
          status_label = $1,
          history = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, code, status, status_label, payment_status, deposit_status,
                deposit_paid_at, total_amount, deposit_amount, paid_amount,
                refunded_amount, held_amount, remaining_amount, created_at, updated_at;
    `;
    const res = await client.query(updateQuery, [
      ORDER_STATUS_LABELS.cancelled,
      JSON.stringify(parsedHistory),
      orderId,
    ]);

    // Hoàn lại tồn kho
    const itemsRes = await client.query(
      `SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = $1;`,
      [orderId],
    );
    for (const item of itemsRes.rows) {
      const productRes = await client.query(
        `SELECT stock, variants FROM products WHERE id = $1 FOR UPDATE;`,
        [item.product_id],
      );
      const product = productRes.rows[0];
      if (!product) continue;
      let variants = Array.isArray(product.variants) ? product.variants : [];
      if (typeof product.variants === 'string') {
        try { variants = JSON.parse(product.variants); } catch { variants = []; }
      }
      const variantIndex = variants.findIndex(
        (variant) => String(variant.id) === String(item.variant_id),
      );
      if (variantIndex >= 0) {
        const variant = variants[variantIndex];
        const stock = Number(variant.stock_quantity ?? variant.stock ?? 0) + Number(item.quantity);
        variants[variantIndex] = { ...variant, stock_quantity: stock, stock };
        const totalStock = variants.reduce(
          (sum, entry) => sum + Number(entry.stock_quantity ?? entry.stock ?? 0),
          0,
        );
        await client.query(
          `UPDATE products SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3;`,
          [totalStock, JSON.stringify(variants), item.product_id],
        );
      } else {
        await client.query(
          `UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
          [item.quantity, item.product_id],
        );
      }
    }

    const updated = res.rows[0];
    return {
      ...updated,
      total_amount: Number(updated.total_amount),
      deposit_amount: Number(updated.deposit_amount),
      paid_amount: Number(updated.paid_amount),
      refunded_amount: Number(updated.refunded_amount),
      held_amount: Number(updated.held_amount),
      remaining_amount: Number(updated.remaining_amount),
      allowed_actions: [],
    };
  }

  // --- ADO01: Quản trị đơn hàng (Admin List) ---

  async getAdminOrders({
    keyword = '',
    status = '',
    payment_status = '',
    view = '',
    page = 1,
    limit = 20,
  } = {}, client = this.db) {
    const conditions = [];
    const values = [];

    if (keyword && keyword.trim()) {
      values.push(`%${keyword.trim().toLowerCase()}%`);
      conditions.push(`(
        LOWER(o.code) LIKE $${values.length} OR
        LOWER(u.name) LIKE $${values.length} OR
        LOWER(u.email) LIKE $${values.length} OR
        LOWER(o.recipient->>'name') LIKE $${values.length}
      )`);
    }

    if (status && status.trim()) {
      values.push(status.trim());
      conditions.push(`o.status = $${values.length}`);
    }

    if (payment_status && payment_status.trim()) {
      values.push(payment_status.trim());
      conditions.push(`o.payment_status = $${values.length}`);
    }

    if (view === 'payments') {
      conditions.push(`(o.paid_amount > 0 OR o.payment_status != 'unpaid')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause};
    `;
    const countRes = await client.query(countQuery, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    values.push(limitNum);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const dataQuery = `
      SELECT o.id, o.code, o.status, o.status_label, o.payment_status, o.deposit_status,
             o.deposit_paid_at, o.total_amount, o.deposit_amount, o.paid_amount,
             o.refunded_amount, o.held_amount, o.remaining_amount, o.created_at, o.updated_at,
             o.payment_method, o.recipient, o.note,
             (SELECT pc.note FROM payment_confirmations pc
              WHERE pc.order_id = o.id ORDER BY pc.confirmed_at DESC LIMIT 1) AS payment_note,
             u.id AS user_id, u.name AS user_name, u.email AS user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;
    const dataRes = await client.query(dataQuery, values);

    const orders = dataRes.rows.map((row) => {
      const parsedRecipient = typeof row.recipient === 'object' ? row.recipient : {};
      const allowedActions = [];
      if (NEXT_STATUS_MAP[row.status]?.length) {
        allowedActions.push('update_status');
      }

      return {
        id: row.id,
        code: row.code,
        status: row.status,
        status_label: row.status_label || ORDER_STATUS_LABELS[row.status] || row.status,
        payment_status: row.payment_status,
        deposit_status: row.deposit_status,
        deposit_paid_at: row.deposit_paid_at,
        total_amount: Number(row.total_amount),
        deposit_amount: Number(row.deposit_amount),
        paid_amount: Number(row.paid_amount),
        refunded_amount: Number(row.refunded_amount),
        held_amount: Number(row.held_amount),
        remaining_amount: Number(row.remaining_amount),
        created_at: row.created_at,
        updated_at: row.updated_at,
        customer: {
          id: row.user_id || null,
          name: row.user_name || parsedRecipient?.name || 'Khách vãng lai',
          email: row.user_email || 'Chưa cung cấp',
        },
        recipient_name: parsedRecipient?.name || row.user_name || 'Khách nhận',
        payment_method: row.payment_method,
        note: row.note || '',
        payment_note: row.payment_note || '',
        allowed_actions: allowedActions,
      };
    });

    return {
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  async bulkDeleteAdminOrders(ids = [], client = this.db) {
    const deleted_ids = [];
    const failed = [];

    for (const id of [...new Set(ids)]) {
      const result = await client.query(
        `SELECT id, code, status, paid_amount, refunded_amount
         FROM orders WHERE id = $1 LIMIT 1;`,
        [id],
      );
      const order = result.rows[0];
      if (!order) {
        failed.push({ id, code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng' });
        continue;
      }

      if (
        order.status !== 'cancelled' ||
        Number(order.paid_amount || 0) > 0 ||
        Number(order.refunded_amount || 0) > 0
      ) {
        failed.push({
          id,
          code: 'ORDER_NOT_DELETABLE',
          message: 'Chỉ được xóa đơn đã hủy và chưa phát sinh thanh toán',
        });
        continue;
      }

      await client.query('DELETE FROM payments WHERE order_id = $1;', [id]);
      const deleted = await client.query(
        `DELETE FROM orders
         WHERE id = $1 AND status = 'cancelled'
           AND COALESCE(paid_amount, 0) = 0
           AND COALESCE(refunded_amount, 0) = 0
         RETURNING id;`,
        [id],
      );
      if (deleted.rows[0]) deleted_ids.push(id);
      else failed.push({ id, code: 'DELETE_FAILED', message: 'Không thể xóa đơn hàng' });
    }

    return { deleted_ids, failed };
  }
  // --- ADO02: Quản trị chi tiết đơn hàng ---

  async getAdminOrderDetail(orderId, client = this.db) {
    const query = `
      SELECT o.*,
             u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [orderId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    const itemsRes = await client.query(`
      SELECT product_id, variant_id, product_name, variant_label, color,
             image_url, unit_price, quantity, line_total
      FROM order_items
      WHERE order_id = $1;
    `, [orderId]);
    const paymentNoteRes = await client.query(
      `SELECT note FROM payment_confirmations WHERE order_id = $1 ORDER BY confirmed_at DESC LIMIT 1;`,
      [orderId],
    );

    const allowedNext = NEXT_STATUS_MAP[row.status] || [];
    const allowedActions = allowedNext.length > 0 ? ['change_status', 'update_shipment'] : [];

    let parsedRecipient = typeof row.recipient === 'object' ? row.recipient : {};
    let parsedShipment = typeof row.shipment === 'object' ? row.shipment : {};
    let parsedHistory = Array.isArray(row.history) ? row.history : [];

    return {
      id: row.id,
      code: row.code,
      customer: {
        id: row.user_id || null,
        name: row.user_name || parsedRecipient.name || 'Khách vãng lai',
        email: row.user_email || 'Chưa cung cấp',
        phone: row.user_phone || parsedRecipient.phone || '',
      },
      status: row.status,
      status_label: row.status_label || ORDER_STATUS_LABELS[row.status] || row.status,
      payment_status: row.payment_status,
      deposit_status: row.deposit_status,
      deposit_paid_at: row.deposit_paid_at,
      payment_method: row.payment_method,
      note: row.note || '',
      payment_note: paymentNoteRes.rows[0]?.note || '',
      payment_mode: row.payment_mode,
      delivery_method: row.delivery_method,
      subtotal: Number(row.subtotal),
      shipping_fee: Number(row.shipping_fee),
      discount_amount: Number(row.discount_amount),
      total_amount: Number(row.total_amount),
      deposit_rate: Number(row.deposit_rate),
      deposit_amount: Number(row.deposit_amount),
      amount_due_now: Number(row.amount_due_now),
      paid_amount: Number(row.paid_amount),
      refunded_amount: Number(row.refunded_amount),
      held_amount: Number(row.held_amount),
      remaining_amount: Number(row.remaining_amount),
      currency: row.currency || 'VND',
      items: itemsRes.rows.map((i) => ({
        ...i,
        unit_price: Number(i.unit_price),
        line_total: Number(i.line_total),
      })),
      recipient: parsedRecipient,
      shipment: parsedShipment,
      history: parsedHistory,
      allowed_next_statuses: allowedNext,
      allowed_actions: allowedActions,
      created_at: row.created_at,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
    };
  }

  // --- ADO03: Cập nhật trạng thái và vận đơn ---

  async updateAdminOrder(orderId, {
    status,
    carrier,
    tracking_number,
    note,
    expected_updated_at,
  }, actorName = 'Quản trị viên', client = this.db) {
    const existing = await client.query(`SELECT * FROM orders WHERE id = $1 LIMIT 1;`, [orderId]);
    if (existing.rows.length === 0) {
      const err = new Error('Không tìm thấy đơn hàng');
      err.statusCode = 404;
      throw err;
    }

    const order = existing.rows[0];
    const nextNote = note === undefined ? (order.note || '') : String(note);
    let newStatus = status || order.status;
    if (newStatus !== order.status && !NEXT_STATUS_MAP[order.status]?.some((item) => item.code === newStatus)) {
      const err = new Error('Trạng thái đơn hàng không thể chuyển theo quy trình hiện tại');
      err.statusCode = 400;
      throw err;
    }
    let newStatusLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;

    let parsedShipment = typeof order.shipment === 'object' ? order.shipment : {};
    if (['cancelled', 'refunded'].includes(newStatus) &&
        ((carrier !== undefined && String(carrier).trim()) ||
         (tracking_number !== undefined && String(tracking_number).trim()))) {
      const err = new Error('Đơn đã hủy hoặc hoàn tiền không được cập nhật vận đơn');
      err.statusCode = 400;
      throw err;
    }
    if (carrier !== undefined) parsedShipment.carrier = carrier;
    if (tracking_number !== undefined) parsedShipment.tracking_number = tracking_number;
    if (newStatus === 'shipping' &&
        (!String(parsedShipment.carrier || '').trim() ||
         !String(parsedShipment.tracking_number || '').trim())) {
      const err = new Error('Đơn đang giao cần có đơn vị vận chuyển và mã vận đơn');
      err.statusCode = 400;
      throw err;
    }
    if (newStatus === 'shipping' && !parsedShipment.shipped_at) {
      parsedShipment.shipped_at = new Date().toISOString();
    }
    if (['delivered', 'completed'].includes(newStatus) && !parsedShipment.delivered_at) {
      parsedShipment.delivered_at = new Date().toISOString();
    }

    let parsedHistory = Array.isArray(order.history) ? order.history : [];
    if (typeof order.history === 'string') {
      try { parsedHistory = JSON.parse(order.history); } catch {}
    }

    if (newStatus !== order.status || note) {
      parsedHistory.push({
        id: String(parsedHistory.length + 1),
        status: newStatus,
        label: newStatusLabel,
        note: note || `Cập nhật sang ${newStatusLabel}`,
        actor_name: actorName,
        created_at: new Date().toISOString(),
      });
    }

    let completedAt = order.completed_at;
    if (newStatus === 'completed' && !completedAt) {
      completedAt = new Date().toISOString();
    }

    const updateQuery = `
      UPDATE orders
      SET status = $1,
          status_label = $2,
          shipment = $3,
          history = $4,
          completed_at = $5,
          note = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING id, code, status, status_label, payment_status, deposit_status,
                deposit_paid_at, total_amount, deposit_amount, paid_amount,
                refunded_amount, held_amount, remaining_amount, created_at,
                updated_at, shipment, completed_at;
    `;
    const res = await client.query(updateQuery, [
      newStatus,
      newStatusLabel,
      JSON.stringify(parsedShipment),
      JSON.stringify(parsedHistory),
      completedAt,
      nextNote,
      orderId,
    ]);

    if (note !== undefined) {
      await client.query(
        `UPDATE payment_confirmations
         SET note = $1
         WHERE id = (
           SELECT id FROM payment_confirmations
           WHERE order_id = $2 ORDER BY confirmed_at DESC LIMIT 1
         );`,
        [nextNote, orderId],
      );
    }

    const updated = res.rows[0];
    const allowedNext = NEXT_STATUS_MAP[updated.status] || [];

    return {
      ...updated,
      total_amount: Number(updated.total_amount),
      deposit_amount: Number(updated.deposit_amount),
      paid_amount: Number(updated.paid_amount),
      refunded_amount: Number(updated.refunded_amount),
      held_amount: Number(updated.held_amount),
      remaining_amount: Number(updated.remaining_amount),
      shipment: parsedShipment,
      allowed_next_statuses: allowedNext,
      allowed_actions: allowedNext.length > 0 ? ['change_status', 'update_shipment'] : [],
    };
  }

  // --- DSH01: Báo cáo Dashboard ---

  async getDashboardSummary({ from, to, timezone = 'Asia/Ho_Chi_Minh' } = {}, client = this.db) {
    const totalRevRes = await client.query(`
      SELECT COALESCE(SUM(paid_amount), 0)::numeric AS revenue
      FROM orders
      WHERE status = 'completed';
    `);

    const todayRevRes = await client.query(`
      SELECT COALESCE(SUM(paid_amount), 0)::numeric AS today_revenue
      FROM orders
      WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE;
    `);

    const orderCountRes = await client.query(`SELECT COUNT(*)::int AS count FROM orders;`);
    const pendingCountRes = await client.query(`SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending';`);

    const lowStockRes = await client.query(`
      SELECT COUNT(*)::int AS count FROM products WHERE stock <= ${LOW_STOCK_THRESHOLD};
    `);

    const statusCountsRes = await client.query(`
      SELECT status, COUNT(*)::int AS count
      FROM orders
      GROUP BY status;
    `);

    const statusCounts = Object.keys(ORDER_STATUS_LABELS).map((st) => {
      const found = statusCountsRes.rows.find((r) => r.status === st);
      return {
        status: st,
        label: ORDER_STATUS_LABELS[st],
        count: found ? found.count : 0,
      };
    });

    const recentOrdersRes = await client.query(`
      SELECT o.id, o.code, o.total_amount, o.status, o.created_at,
             u.name AS customer_name, o.recipient->>'name' AS recipient_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 5;
    `);

    const recentOrders = recentOrdersRes.rows.map((r) => ({
      id: r.id,
      code: r.code,
      customer_name: r.customer_name || r.recipient_name || 'Khách hàng',
      total_amount: Number(r.total_amount),
      status: r.status,
      created_at: r.created_at,
    }));

    return {
      revenue: Number(totalRevRes.rows[0]?.revenue || 0),
      today_revenue: Number(todayRevRes.rows[0]?.today_revenue || 0),
      order_count: orderCountRes.rows[0]?.count || 0,
      pending_order_count: pendingCountRes.rows[0]?.count || 0,
      low_stock_count: lowStockRes.rows[0]?.count || 0,
      low_stock_threshold: LOW_STOCK_THRESHOLD,
      status_counts: statusCounts,
      recent_orders: recentOrders,
      period: {
        from: from || new Date(new Date().getFullYear(), 0, 1).toISOString(),
        to: to || new Date().toISOString(),
        timezone,
        revenue_date_basis: 'completed_at',
      },
    };
  }

  // --- REP01: Báo cáo bán hàng (Sales Report) ---

  async getSalesReport({
    year,
    from,
    to,
    group_by = 'month',
    timezone = 'Asia/Ho_Chi_Minh',
    date_basis = 'created_at',
  } = {}, client = this.db) {
    const selectedYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const summaryRes = await client.query(`
      SELECT COUNT(*)::int AS order_count,
             COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_order_count,
             COALESCE(SUM(paid_amount), 0)::numeric AS revenue,
             COALESCE(SUM(held_amount), 0)::numeric AS held_amount,
             COALESCE(SUM(refunded_amount), 0)::numeric AS refunded_amount
      FROM orders
      WHERE EXTRACT(YEAR FROM created_at) = $1;
    `, [selectedYear]);

    const summary = {
      order_count: summaryRes.rows[0]?.order_count || 0,
      completed_order_count: summaryRes.rows[0]?.completed_order_count || 0,
      revenue: Number(summaryRes.rows[0]?.revenue || 0),
      held_amount: Number(summaryRes.rows[0]?.held_amount || 0),
      refunded_amount: Number(summaryRes.rows[0]?.refunded_amount || 0),
    };

    // Tạo các dòng cho 12 tháng
    const monthlyRes = await client.query(`
      SELECT EXTRACT(MONTH FROM created_at)::int AS month,
             COUNT(*)::int AS order_count,
             COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_order_count,
             COALESCE(SUM(paid_amount), 0)::numeric AS revenue,
             COALESCE(SUM(held_amount), 0)::numeric AS held_amount,
             COALESCE(SUM(refunded_amount), 0)::numeric AS refunded_amount
      FROM orders
      WHERE EXTRACT(YEAR FROM created_at) = $1
      GROUP BY EXTRACT(MONTH FROM created_at);
    `, [selectedYear]);

    const rows = [];
    for (let m = 1; m <= 12; m++) {
      const found = monthlyRes.rows.find((r) => r.month === m);
      const mStart = new Date(selectedYear, m - 1, 1).toISOString();
      const mEnd = new Date(selectedYear, m, 0, 23, 59, 59).toISOString();

      rows.push({
        period_start: mStart,
        period_end: mEnd,
        label: `Tháng ${m}`,
        order_count: found ? found.order_count : 0,
        completed_order_count: found ? found.completed_order_count : 0,
        revenue: found ? Number(found.revenue) : 0,
        held_amount: found ? Number(found.held_amount) : 0,
        refunded_amount: found ? Number(found.refunded_amount) : 0,
      });
    }

    return {
      summary,
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
