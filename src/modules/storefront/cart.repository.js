import pool from '../../config/db.js';

export class CartRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async getOrCreateCart(userId, client = this.db) {
    let cartRes = await client.query(`SELECT id, user_id, updated_at FROM carts WHERE user_id = $1 LIMIT 1;`, [userId]);
    if (cartRes.rows.length === 0) {
      cartRes = await client.query(`
        INSERT INTO carts (user_id) VALUES ($1) RETURNING id, user_id, updated_at;
      `, [userId]);
    }
    return cartRes.rows[0];
  }

  async getCart(userId, client = this.db) {
    const cart = await this.getOrCreateCart(userId, client);

    const query = `
      SELECT ci.id, ci.product_id, ci.variant_id, ci.quantity, ci.created_at,
             p.name AS product_name, p.image, p.price, p.stock, p.variants, p.active,
             p.allow_deposit, p.deposit_rate
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at DESC;
    `;
    const result = await client.query(query, [cart.id]);

    const items = [];
    let subtotal = 0;
    let totalItems = 0;

    for (const row of result.rows) {
      let parsedVariants = Array.isArray(row.variants) ? row.variants : [];
      if (typeof row.variants === 'string') {
        try { parsedVariants = JSON.parse(row.variants); } catch {}
      }

      // Tìm biến thể tương ứng
      const matchedVariant = parsedVariants.find((v) => String(v.id) === String(row.variant_id)) || parsedVariants[0] || null;

      const unitPrice = matchedVariant?.price !== undefined ? Number(matchedVariant.price) : Number(row.price);
      const stockQuantity = matchedVariant?.stock_quantity !== undefined
        ? Number(matchedVariant.stock_quantity)
        : (matchedVariant?.stock !== undefined ? Number(matchedVariant.stock) : Number(row.stock));

      const lineTotal = unitPrice * Number(row.quantity);
      const isAvailable = Boolean(row.active) && stockQuantity >= Number(row.quantity);

      subtotal += lineTotal;
      totalItems += Number(row.quantity);

      items.push({
        id: row.id,
        product_id: row.product_id,
        variant_id: row.variant_id,
        product_name: row.product_name,
        variant_label: matchedVariant?.label || matchedVariant?.name || 'Mặc định',
        color: matchedVariant?.color || '',
        image_url: matchedVariant?.image || '/product-placeholder.svg',
        allow_deposit: Boolean(row.allow_deposit),
        deposit_rate: Number(row.deposit_rate),
        unit_price: unitPrice,
        quantity: Number(row.quantity),
        stock_quantity: stockQuantity,
        line_total: lineTotal,
        is_available: isAvailable,
      });
    }

    return {
      id: cart.id,
      items,
      line_count: items.length,
      item_count: totalItems,
      subtotal,
      currency: 'VND',
      updated_at: cart.updated_at,
    };
  }

  async addItem(userId, { product_id, variant_id, quantity = 1 }, client = this.db) {
    const cart = await this.getOrCreateCart(userId, client);
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    // Kiểm tra sản phẩm và biến thể
    const pRes = await client.query(`SELECT id, name, price, stock, variants, active FROM products WHERE id = $1;`, [product_id]);
    if (pRes.rows.length === 0) {
      const err = new Error('Không tìm thấy sản phẩm');
      err.statusCode = 404;
      throw err;
    }

    const prod = pRes.rows[0];
    let parsedVariants = Array.isArray(prod.variants) ? prod.variants : [];
    if (typeof prod.variants === 'string') {
      try { parsedVariants = JSON.parse(prod.variants); } catch {}
    }

    const matchedVariant = parsedVariants.find((v) => String(v.id) === String(variant_id)) || parsedVariants[0];
    const targetVariantId = matchedVariant?.id ? String(matchedVariant.id) : (variant_id || 'default');

    // Kiểm tra xem item đã có trong giỏ chưa
    const existing = await client.query(`
      SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2 AND variant_id = $3 LIMIT 1;
    `, [cart.id, product_id, targetVariantId]);

    if (existing.rows.length > 0) {
      const newQty = existing.rows[0].quantity + qty;
      await client.query(`
        UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;
      `, [newQty, existing.rows[0].id]);
    } else {
      await client.query(`
        INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
        VALUES ($1, $2, $3, $4);
      `, [cart.id, product_id, targetVariantId, qty]);
    }

    await client.query(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, [cart.id]);
    return await this.getCart(userId, client);
  }

  async updateItemQuantity(userId, itemId, quantity, client = this.db) {
    const cart = await this.getOrCreateCart(userId, client);
    const qty = parseInt(quantity, 10);

    if (isNaN(qty) || qty <= 0) {
      await client.query(`DELETE FROM cart_items WHERE id = $1 AND cart_id = $2;`, [itemId, cart.id]);
    } else {
      const updated = await client.query(`
        UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND cart_id = $3 RETURNING id;
      `, [qty, itemId, cart.id]);
      if (updated.rows.length === 0) {
        const err = new Error('Không tìm thấy sản phẩm trong giỏ');
        err.statusCode = 404;
        throw err;
      }
    }

    await client.query(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, [cart.id]);
    return await this.getCart(userId, client);
  }

  async removeItem(userId, itemId, client = this.db) {
    const cart = await this.getOrCreateCart(userId, client);
    await client.query(`DELETE FROM cart_items WHERE id = $1 AND cart_id = $2;`, [itemId, cart.id]);
    await client.query(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, [cart.id]);
    return await this.getCart(userId, client);
  }

  async removeItemsByIds(userId, itemIds = [], client = this.db) {
    if (!itemIds || itemIds.length === 0) return;
    const cart = await this.getOrCreateCart(userId, client);
    await client.query(`DELETE FROM cart_items WHERE id = ANY($1::uuid[]) AND cart_id = $2;`, [itemIds, cart.id]);
    await client.query(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, [cart.id]);
  }
}

export const cartRepository = new CartRepository();
export default cartRepository;
