import pool from '../../config/db.js';
import { withTransaction } from '../../config/transaction.js';
import { withIdempotency } from '../../config/idempotency.js';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { currentStock, findVariant, lockProduct, parseJsonArray, saveStock, variantStock } from '../catalog/productStock.js';

export const LOW_STOCK_THRESHOLD = 5;

export class InventoryRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async getInventory({
    keyword = '',
    low_stock,
    sort = 'name',
    page = 1,
    limit = 20,
  } = {}, client = this.db) {
    const productsRes = await client.query(`
      SELECT id, name, stock, variants
      FROM products
      ORDER BY name ASC;
    `);

    let inventoryList = [];

    for (const prod of productsRes.rows) {
      let parsedVariants = parseJsonArray(prod.variants);

      if (parsedVariants.length > 0) {
        parsedVariants.forEach((v, idx) => {
          const vStock = variantStock(v, prod.stock);
          inventoryList.push({
            product_id: prod.id,
            product_name: prod.name,
            variant_id: v.id ? String(v.id) : `v_${idx + 1}`,
            variant_label: v.label || v.name || `Phiên bản ${idx + 1}`,
            color: v.color || '',
            stock_quantity: vStock,
            is_low_stock: vStock <= LOW_STOCK_THRESHOLD,
          });
        });
      } else {
        const pStock = Number(prod.stock);
        inventoryList.push({
          product_id: prod.id,
          product_name: prod.name,
          variant_id: 'default',
          variant_label: 'Tiêu chuẩn',
          color: '',
          stock_quantity: pStock,
          is_low_stock: pStock <= LOW_STOCK_THRESHOLD,
        });
      }
    }

    // Lọc keyword
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      inventoryList = inventoryList.filter(
        (item) => item.product_name.toLowerCase().includes(kw) || item.variant_label.toLowerCase().includes(kw)
      );
    }

    // Lọc low_stock
    if (low_stock === true || low_stock === 'true') {
      inventoryList = inventoryList.filter((item) => item.is_low_stock);
    }

    // Sort
    if (sort === 'stock_asc') {
      inventoryList.sort((a, b) => a.stock_quantity - b.stock_quantity);
    } else if (sort === 'stock_desc') {
      inventoryList.sort((a, b) => b.stock_quantity - a.stock_quantity);
    } else {
      // Mặc định: theo tên sản phẩm rồi tên biến thể
      inventoryList.sort((a, b) => {
        const nameCmp = a.product_name.localeCompare(b.product_name);
        if (nameCmp !== 0) return nameCmp;
        return a.variant_label.localeCompare(b.variant_label);
      });
    }

    const total = inventoryList.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;
    const pagedItems = inventoryList.slice(offset, offset + limitNum);

    return {
      items: pagedItems,
      low_stock_threshold: LOW_STOCK_THRESHOLD,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  async adjustInventory({ product_id, variant_id, delta, reason = '', actor_id = null, idempotency_key }, client = this.db) {
    if (client === this.db) return withTransaction(this.db, tx => withIdempotency(tx, {
      actorId: actor_id, key: idempotency_key, operation: 'inventory:adjust', payload: { product_id, variant_id, delta, reason },
    }, () => this.adjustInventory({ product_id, variant_id, delta, reason, actor_id }, tx)));
    const numDelta = Number(delta);
    if (!Number.isSafeInteger(numDelta) || numDelta === 0) {
      throw new BadRequestError('Số lượng điều chỉnh (delta) không hợp lệ');
    }

    const product = await lockProduct(client, product_id);
    if (!product) throw new NotFoundError('Không tìm thấy sản phẩm');
    if (product.variants.length > 0 && !findVariant(product.variants, variant_id)) {
      throw new NotFoundError('Không tìm thấy biến thể');
    }

    const stockBefore = currentStock(product, variant_id);
    const stockAfter = stockBefore + numDelta;
    if (stockAfter < 0) {
      throw new BadRequestError('Số lượng tồn sau điều chỉnh không được nhỏ hơn 0');
    }
    await saveStock(client, product, variant_id, stockAfter);

    const adj = await this.recordAdjustment({
      product_id,
      variant_id,
      delta: numDelta,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reason,
      actor_id,
    }, client);

    // Lấy thông tin actor
    let actor = { id: actor_id, name: 'Quản trị viên' };
    if (actor_id) {
      const uRes = await client.query(`SELECT id, name FROM users WHERE id = $1;`, [actor_id]);
      if (uRes.rows[0]) actor = uRes.rows[0];
    }

    return {
      id: adj.id,
      product_id: adj.product_id,
      variant_id: adj.variant_id,
      delta: adj.delta,
      stock_before: adj.stock_before,
      stock_after: adj.stock_after,
      reason: adj.reason,
      actor,
      created_at: adj.created_at,
    };
  }

  // Ghi nhật ký vào bảng inventory_adjustments
  async recordAdjustment({ product_id, variant_id, delta, stock_before, stock_after, reason, actor_id }, client = this.db) {
    const result = await client.query(`
      INSERT INTO inventory_adjustments (
        product_id, variant_id, delta, stock_before, stock_after, reason, actor_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, product_id, variant_id, delta, stock_before, stock_after, reason, actor_id, created_at;
    `, [
      product_id,
      variant_id || 'default',
      delta,
      stock_before,
      stock_after,
      reason || 'Điều chỉnh thủ công',
      actor_id || null,
    ]);
    return result.rows[0];
  }

  async getAdjustments({
    product_id,
    variant_id,
    page = 1,
    limit = 20,
  } = {}, client = this.db) {
    const conditions = [];
    const values = [];

    if (product_id) {
      values.push(product_id);
      conditions.push(`ia.product_id = $${values.length}`);
    }

    if (variant_id) {
      values.push(variant_id);
      conditions.push(`ia.variant_id = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*)::int AS total FROM inventory_adjustments ia ${whereClause};`;
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
      SELECT ia.id, ia.product_id, ia.variant_id, ia.delta, ia.stock_before, ia.stock_after,
             ia.reason, ia.created_at,
             p.name AS product_name, p.variants,
             u.id AS actor_id, u.name AS actor_name
      FROM inventory_adjustments ia
      LEFT JOIN products p ON ia.product_id = p.id
      LEFT JOIN users u ON ia.actor_id = u.id
      ${whereClause}
      ORDER BY ia.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;
    const dataRes = await client.query(dataQuery, values);

    const items = dataRes.rows.map((row) => {
      const parsedVariants = parseJsonArray(row.variants);
      const matched = parsedVariants.find((v) => String(v.id) === String(row.variant_id));

      return {
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name || '',
        variant_id: row.variant_id,
        variant_label: matched?.label || matched?.name || 'Mặc định',
        delta: row.delta,
        stock_before: row.stock_before,
        stock_after: row.stock_after,
        reason: row.reason,
        actor: {
          id: row.actor_id || null,
          name: row.actor_name || 'Hệ thống',
        },
        created_at: row.created_at,
      };
    });

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }
}

export const inventoryRepository = new InventoryRepository();
export default inventoryRepository;
