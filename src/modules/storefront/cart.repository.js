import pool from '../../config/db.js';
import { withTransaction } from '../../config/transaction.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { parseJsonArray, variantStock } from '../catalog/productStock.js';
import {
  CUSTOM_BOUQUET,
  assertBouquetAddable,
  bouquetKey,
  bouquetLine,
  normalizeBouquetItems,
  normalizeBouquetQuantity,
} from './customBouquet.js';
import { normalizeBouquetStyle } from './bouquetStyle.js';

// Đọc các sản phẩm hoa cành theo id (một truy vấn cho mọi bó trong giỏ)
async function loadStemProducts(client, productIds) {
  const ids = [...new Set(productIds.map(String))];
  if (!ids.length) return new Map();
  const { rows } = await client.query(
    `SELECT id, name, image, stock, variants, active, sold_by_stem, allow_deposit, deposit_rate
     FROM products WHERE id = ANY($1::uuid[]);`,
    [ids],
  );
  return new Map(rows.map((row) => [String(row.id), { ...row, variants: parseJsonArray(row.variants) }]));
}

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
             ci.item_type, ci.bouquet_components, ci.bouquet_style,
             p.id AS joined_product_id,
             p.name AS product_name, p.image, p.price, p.stock, p.variants, p.active,
             p.allow_deposit, p.deposit_rate
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at DESC;
    `;
    const result = await client.query(query, [cart.id]);

    // Dòng bó hoa không có product_id: giá tính lại từ giá cành hiện tại trong DB
    const bouquetRows = result.rows.filter((row) => row.item_type === CUSTOM_BOUQUET);
    const stemProducts = await loadStemProducts(
      client,
      bouquetRows.flatMap((row) => parseJsonArray(row.bouquet_components).map((component) => component.product_id)),
    );

    const items = [];
    let subtotal = 0;
    let totalItems = 0;

    for (const row of result.rows) {
      if (row.item_type === CUSTOM_BOUQUET) {
        const line = bouquetLine({
          id: row.id,
          variant_id: row.variant_id,
          quantity: row.quantity,
          components: parseJsonArray(row.bouquet_components),
          style: row.bouquet_style,
        }, stemProducts);
        subtotal += line.line_total;
        totalItems += line.quantity;
        items.push(line);
        continue;
      }
      if (!row.joined_product_id) continue;
      let parsedVariants = parseJsonArray(row.variants);

      // Tìm biến thể tương ứng
      const matchedVariant = parsedVariants.find((v) => String(v.id) === String(row.variant_id)) || parsedVariants[0] || null;

      const unitPrice = matchedVariant?.price !== undefined ? Number(matchedVariant.price) : Number(row.price);
      const stockQuantity = variantStock(matchedVariant, row.stock);

      const lineTotal = unitPrice * Number(row.quantity);
      const isAvailable = Boolean(row.active) && stockQuantity >= Number(row.quantity);

      subtotal += lineTotal;
      totalItems += Number(row.quantity);

      items.push({
        id: row.id,
        item_type: 'product',
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
      throw new NotFoundError('Không tìm thấy sản phẩm');
    }

    const prod = pRes.rows[0];
    const parsedVariants = parseJsonArray(prod.variants);

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

  // CART05: thêm bó hoa tự tạo. Chỉ nhận thành phần, kiểu gói và số bó; giá luôn tính lại từ DB.
  addBouquet(userId, { items, quantity, wrap, height } = {}, client = this.db) {
    const components = normalizeBouquetItems(items);
    const qty = normalizeBouquetQuantity(quantity);
    const style = normalizeBouquetStyle({ wrap, height });
    if (client === this.db) {
      return withTransaction(this.db, (tx) => this.insertBouquet(userId, components, qty, style, tx));
    }
    return this.insertBouquet(userId, components, qty, style, client);
  }

  async insertBouquet(userId, components, qty, style, client) {
    const cart = await this.getOrCreateCart(userId, client);
    // Khóa giỏ để hai lần thêm cùng bó đồng thời vẫn gộp vào một dòng
    await client.query('SELECT id FROM carts WHERE id = $1 FOR UPDATE;', [cart.id]);
    const variantId = bouquetKey(components, style);
    const existing = await client.query(`
      SELECT id, quantity FROM cart_items
      WHERE cart_id = $1 AND item_type = $2 AND variant_id = $3 LIMIT 1;
    `, [cart.id, CUSTOM_BOUQUET, variantId]);
    const totalQuantity = (existing.rows[0]?.quantity || 0) + qty;

    const products = await loadStemProducts(client, components.map((component) => component.product_id));
    assertBouquetAddable(components, products, totalQuantity);

    if (existing.rows.length > 0) {
      await client.query(
        'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
        [totalQuantity, existing.rows[0].id],
      );
    } else {
      await client.query(`
        INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, item_type, bouquet_components, bouquet_style)
        VALUES ($1, NULL, $2, $3, $4, $5, $6);
      `, [cart.id, variantId, qty, CUSTOM_BOUQUET, JSON.stringify(components), JSON.stringify(style)]);
    }
    await client.query('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [cart.id]);
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
        throw new NotFoundError('Không tìm thấy sản phẩm trong giỏ');
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
