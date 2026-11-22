import { normalizeFlowerSpecies } from './flowerSpecies.js';
import pool from '../../config/db.js';
import { BadRequestError, ConflictError, ForbiddenError } from '../../common/errors/AppError.js';
import { parseJsonArray } from './productStock.js';

// Query string gửi giá trị dạng chuỗi: '' hoặc thiếu nghĩa là không lọc
const hasValue = (value) => value !== undefined && value !== null && value !== '';
const isTrue = (value) => value === true || value === 'true';
// Cỡ bông so với hoa chuẩn, tính theo phần trăm
export const clampHeadSize = (value) =>
  Math.min(300, Math.max(30, Math.round(Number(value)) || 100));

const SORTS = {
  newest: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  name_asc: 'p.name ASC',
  name_desc: 'p.name DESC',
};

// Bộ lọc dùng chung cho danh sách sản phẩm của khách và của quản trị
function productFilters({ keyword, category_id, is_pinned, flower_species }) {
  const conditions = [];
  const values = [];
  if (keyword?.trim()) {
    values.push(`%${keyword.trim().toLowerCase()}%`);
    conditions.push(`(LOWER(p.name) LIKE $${values.length} OR LOWER(p.description) LIKE $${values.length})`);
  }
  if (category_id?.trim()) {
    values.push(category_id.trim());
    conditions.push(`(p.category_id::text = $${values.length} OR LOWER(p.category) = LOWER($${values.length}))`);
  }
  if (hasValue(is_pinned)) {
    values.push(isTrue(is_pinned));
    conditions.push(`(p.is_pinned = $${values.length} OR p.featured = $${values.length})`);
  }
  if (flower_species !== undefined) {
    const [species] = normalizeFlowerSpecies([flower_species]);
    values.push(species.toLowerCase());
    conditions.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.flower_species) AS species(name) WHERE LOWER(BTRIM(REGEXP_REPLACE(species.name, '[[:space:]]+', ' ', 'g'))) = $${values.length})`);
    conditions.push(`NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.attributes) AS attr WHERE COALESCE(attr->>'name', attr->>'label') IN ('visibility', '_visibility') AND COALESCE(attr->>'value', 'public') <> 'public')`);
  }
  return { conditions, values };
}

export class CatalogRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async listFlowerSpecies() {
    const { rows } = await this.db.query(`SELECT MIN(species.name) AS name FROM products p, jsonb_array_elements_text(p.flower_species) AS species(name) GROUP BY LOWER(species.name) ORDER BY LOWER(species.name)`);
    return rows.map(row => row.name);
  }

  // --- Categories Management (ADC01 - ADC05, CAT03) ---

  async findAllCategories(client = this.db) {
    const query = `
      SELECT c.id, c.name,
             COUNT(p.id)::int AS product_count,
             c.created_at, c.updated_at
      FROM categories c
      LEFT JOIN products p ON (p.category_id = c.id OR LOWER(p.category) = LOWER(c.name))
      GROUP BY c.id, c.name
      ORDER BY c.name ASC;
    `;
    const result = await client.query(query);
    return result.rows;
  }

  async findCategoryById(id, client = this.db) {
    const query = `
      SELECT c.id, c.name,
             COUNT(p.id)::int AS product_count,
             c.created_at, c.updated_at
      FROM categories c
      LEFT JOIN products p ON (p.category_id = c.id OR LOWER(p.category) = LOWER(c.name))
      WHERE c.id = $1
      GROUP BY c.id, c.name
      LIMIT 1;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findCategoryByName(name, client = this.db) {
    const query = `
      SELECT id, name, created_at, updated_at
      FROM categories
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1;
    `;
    const result = await client.query(query, [name.trim()]);
    return result.rows[0] || null;
  }

  async createCategory(name, client = this.db) {
    const query = `
      INSERT INTO categories (name)
      VALUES ($1)
      RETURNING id, name, 0 AS product_count, created_at, updated_at;
    `;
    const result = await client.query(query, [name.trim()]);
    return result.rows[0];
  }

  async updateCategory(id, name, client = this.db) {
    const query = `
      UPDATE categories
      SET name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, created_at, updated_at;
    `;
    const result = await client.query(query, [name.trim(), id]);
    if (!result.rows[0]) return null;

    const countRes = await client.query(`
      SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1 OR LOWER(category) = LOWER($2)
    `, [id, name.trim()]);

    return {
      ...result.rows[0],
      product_count: countRes.rows[0]?.count || 0,
    };
  }

  async deleteCategory(id, client = this.db) {
    // Kiểm tra xem danh mục có sản phẩm không
    const countRes = await client.query(`
      SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1
    `, [id]);
    if (countRes.rows[0]?.count > 0) {
      throw new BadRequestError('Không thể xóa danh mục đang có sản phẩm');
    }

    const query = `
      DELETE FROM categories
      WHERE id = $1
      RETURNING id;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async bulkDeleteCategories(ids = [], client = this.db) {
    const deleted_ids = [];
    const failed = [];

    for (const id of ids) {
      try {
        const cat = await this.findCategoryById(id, client);
        if (!cat) {
          failed.push({ id, code: 'NOT_FOUND', message: 'Không tìm thấy danh mục' });
          continue;
        }
        if (cat.product_count > 0) {
          failed.push({ id, code: 'HAS_PRODUCTS', message: 'Danh mục đang có sản phẩm, không thể xóa' });
          continue;
        }

        await client.query(`DELETE FROM categories WHERE id = $1`, [id]);
        deleted_ids.push(id);
      } catch (err) {
        failed.push({ id, code: 'ERROR', message: err.message });
      }
    }

    return { deleted_ids, failed };
  }

  // --- Customer Catalog (CAT01, CAT02) ---

  async findAllCustomer({
    keyword = '',
    category_id = '',
    min_price,
    max_price,
    in_stock,
    flower_species,
    is_pinned,
    sold_by_stem,
    sort = 'newest',
    page = 1,
    limit = 20,
  } = {}, client = this.db) {
    const offset = (Math.max(1, page) - 1) * limit;
    const { conditions, values } = productFilters({ keyword, category_id, is_pinned, flower_species });
    conditions.unshift('(p.active = TRUE)');
    if (isTrue(in_stock)) conditions.push('p.stock > 0');
    if (hasValue(sold_by_stem)) {
      values.push(isTrue(sold_by_stem));
      conditions.push(`p.sold_by_stem = $${values.length}`);
    }
    if (hasValue(min_price)) {
      values.push(Number(min_price));
      conditions.push(`p.price >= $${values.length}`);
    }
    if (hasValue(max_price)) {
      values.push(Number(max_price));
      conditions.push(`p.price <= $${values.length}`);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Sản phẩm được ghim luôn đứng đầu, sau đó mới theo cách sắp xếp khách chọn
    const orderBy = `COALESCE(p.is_pinned, p.featured, FALSE) DESC, ${SORTS[sort] || SORTS.newest}, p.id ASC`;

    const countQuery = `SELECT COUNT(*) AS total FROM products p ${whereClause};`;
    const countRes = await client.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const priceMinMaxRes = await client.query(`SELECT MIN(price) AS min_p, MAX(price) AS max_p FROM products WHERE active = TRUE;`);
    const minPriceFilter = Number(priceMinMaxRes.rows[0]?.min_p) || 0;
    const maxPriceFilter = Number(priceMinMaxRes.rows[0]?.max_p) || 0;

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT p.id, p.name, p.image, p.price, p.old_price, p.stock,
             p.category, p.category_id, c.name AS category_name,
             COALESCE(p.is_pinned, p.featured, FALSE) AS is_pinned, p.sold_by_stem
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const dataRes = await client.query(dataQuery, values);

    const items = dataRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      image_url: row.image || '',
      category: {
        id: row.category_id || null,
        name: row.category_name || row.category || 'Mặc định',
      },
      price: Number(row.price),
      old_price: row.old_price ? Number(row.old_price) : null,
      stock_quantity: Number(row.stock),
      is_pinned: Boolean(row.is_pinned),
      sold_by_stem: Boolean(row.sold_by_stem),
    }));

    return {
      items,
      filters: {
        min_price: minPriceFilter,
        max_price: maxPriceFilter,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // --- Admin Products List (ADP01) ---

  async findAdminProducts({
    keyword = '',
    category_id = '',
    is_active,
    is_pinned,
    page = 1,
    limit = 20,
  } = {}, client = this.db) {
    const offset = (Math.max(1, page) - 1) * limit;
    const { conditions, values } = productFilters({ keyword, category_id, is_pinned });
    if (hasValue(is_active)) {
      values.push(isTrue(is_active));
      conditions.push(`p.active = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) AS total FROM products p ${whereClause};`;
    const countRes = await client.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT p.id, p.name, p.image, p.price, p.stock,
             p.category, p.category_id, c.name AS category_name,
             p.active AS is_active,
             COALESCE(p.is_pinned, p.featured, FALSE) AS is_pinned
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY COALESCE(p.is_pinned, p.featured, FALSE) DESC, p.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const dataRes = await client.query(dataQuery, values);

    const items = dataRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      image_url: row.image || '',
      category: {
        id: row.category_id || null,
        name: row.category_name || row.category || 'Mặc định',
      },
      price_from: Number(row.price),
      stock_quantity: Number(row.stock),
      is_pinned: Boolean(row.is_pinned),
      is_active: Boolean(row.is_active),
    }));

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // --- Product Detail (CAT02, ADP02) ---

  async findById(id, client = this.db) {
    const query = `
      SELECT p.id, p.name, p.category, p.category_id, p.description,
             p.price, p.old_price AS "oldPrice", p.old_price, p.stock,
             p.image, p.images, p.variants, p.attributes, p.flower_species,
             COALESCE(p.is_pinned, p.featured, FALSE) AS is_pinned,
             COALESCE(p.allow_deposit, p.deposit, FALSE) AS allow_deposit,
             COALESCE(p.deposit_rate, 20) AS deposit_rate,
             p.featured, p.active, p.deposit, p.sold_by_stem, p.stem_head_size,
             p.deposit_rate AS "depositRate",
             p.created_at AS "createdAt", p.updated_at AS "updatedAt",
             p.created_at, p.updated_at,
             c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findDetailFormatted(id, client = this.db) {
    const raw = await this.findById(id, client);
    if (!raw) return null;

    let parsedImages = parseJsonArray(raw.images);
    if (parsedImages.length === 0 && raw.image) {
      parsedImages = [{ id: '1', url: raw.image, alt_text: raw.name, sort_order: 1 }];
    }

    const parsedVariants = parseJsonArray(raw.variants);

    const parsedAttributes = parseJsonArray(raw.attributes);

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description || '',
      category_id: raw.category_id || null,
      category: {
        id: raw.category_id || null,
        name: raw.category_name || raw.category || 'Mặc định',
      },
      images: parsedImages,
      variants: parsedVariants,
      attributes: parsedAttributes,
      flower_species: parseJsonArray(raw.flower_species),
      price: Number(raw.price),
      old_price: raw.old_price ? Number(raw.old_price) : null,
      stock_quantity: Number(raw.stock),
      is_pinned: Boolean(raw.is_pinned),
      is_active: Boolean(raw.active),
      sold_by_stem: Boolean(raw.sold_by_stem),
      stem_head_size: Number(raw.stem_head_size) || 100,
      allow_deposit: Boolean(raw.allow_deposit),
      deposit_rate: Number(raw.deposit_rate) || 20,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  // --- Create Product (ADP03) ---

  // Controller đã quy đổi alias cũ (featured/active/deposit) sang tên chuẩn trước khi gọi
  async create({
    name,
    category,
    category_id = null,
    description = '',
    price = 0,
    old_price = null,
    stock = 0,
    image = '',
    images = [],
    variants = [],
    attributes = [],
    flower_species = [],
    is_pinned = false,
    is_active = true,
    allow_deposit = false,
    deposit_rate = 20,
    sold_by_stem = false,
    stem_head_size = 100,
  }, client = this.db) {
    // Sản phẩm lưu cả tên lẫn id danh mục: có cái nào thì tra ra cái còn lại
    let categoryId = category_id;
    let categoryName = category;
    if (categoryId && !categoryName) {
      categoryName = (await this.findCategoryById(categoryId, client))?.name;
    } else if (categoryName && !categoryId) {
      categoryId = (await this.findCategoryByName(categoryName, client))?.id;
    }

    const result = await client.query(`
      INSERT INTO products (
        name, category, category_id, description, price, old_price, stock, image, images,
        variants, attributes, featured, is_pinned, active, deposit, allow_deposit, deposit_rate, flower_species,
        sold_by_stem, stem_head_size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13, $14, $14, $15, $16, $17, $18)
      RETURNING id;
    `, [
      name,
      categoryName || 'Mặc định',
      categoryId || null,
      description,
      Number(price) || 0,
      old_price === null || old_price === undefined ? null : Number(old_price),
      Number(stock) || 0,
      image,
      JSON.stringify(images || []),
      JSON.stringify(variants || []),
      JSON.stringify(attributes || []),
      Boolean(is_pinned),
      Boolean(is_active),
      Boolean(allow_deposit),
      Number(deposit_rate) || 20,
      JSON.stringify(normalizeFlowerSpecies(flower_species)),
      Boolean(sold_by_stem),
      clampHeadSize(stem_head_size),
    ]);
    return result.rows[0];
  }

  // --- Update Product (ADP04) ---

  async update(id, fields = {}, client = this.db) {
    const columnMap = {
      name: 'name',
      category: 'category',
      category_id: 'category_id',
      description: 'description',
      price: 'price',
      oldPrice: 'old_price',
      old_price: 'old_price',
      stock: 'stock',
      image: 'image',
      images: 'images',
      variants: 'variants',
      attributes: 'attributes',
      flower_species: 'flower_species',
      featured: 'featured',
      is_pinned: 'is_pinned',
      active: 'active',
      is_active: 'active',
      deposit: 'deposit',
      allow_deposit: 'allow_deposit',
      sold_by_stem: 'sold_by_stem',
      stem_head_size: 'stem_head_size',
      depositRate: 'deposit_rate',
      deposit_rate: 'deposit_rate',
    };

    // Gom theo cột để alias (vd. active/is_active) không gán trùng một cột trong cùng câu UPDATE
    const columns = new Map();
    for (const [key, val] of Object.entries(fields)) {
      const col = columnMap[key];
      if (!col || val === undefined) continue;
      const normalized = col === 'flower_species' ? normalizeFlowerSpecies(val) : val;
      const value = ['images', 'variants', 'attributes', 'flower_species'].includes(col) && typeof val === 'object'
        ? JSON.stringify(normalized)
        : val;
      columns.set(col, value);
      // Đồng bộ đôi cột tương thích
      if (col === 'is_pinned' || col === 'featured') {
        columns.set('is_pinned', value);
        columns.set('featured', value);
      } else if (col === 'allow_deposit' || col === 'deposit') {
        columns.set('allow_deposit', value);
        columns.set('deposit', value);
      }
    }

    const values = [...columns.values()];
    const setClauses = [...columns.keys()].map((col, index) => `${col} = $${index + 1}`);

    if (setClauses.length === 0) return await this.findById(id, client);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE products
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, name, category, category_id, description, price, old_price AS "oldPrice", stock,
                image, images, variants, attributes, featured, is_pinned, active, deposit, allow_deposit,
                deposit_rate AS "depositRate", created_at AS "createdAt", updated_at AS "updatedAt",
                created_at, updated_at;
    `;

    const result = await client.query(query, values);
    return result.rows[0] || null;
  }

  // --- Delete Product (ADP05, ADP06) ---

  async delete(id, client = this.db) {
    const query = `
      DELETE FROM products
      WHERE id = $1
      RETURNING id, name;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async bulkDelete(ids = [], client = this.db) {
    const deleted_ids = [];
    const failed = [];

    for (const id of ids) {
      try {
        const item = await this.findById(id, client);
        if (!item) {
          failed.push({ id, code: 'NOT_FOUND', message: 'Không tìm thấy sản phẩm' });
          continue;
        }

        // Kiểm tra xem sản phẩm có trong đơn hàng không
        const orderItemRes = await client.query(`SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1;`, [id]);
        if (orderItemRes.rows.length > 0) {
          failed.push({ id, code: 'ORDER_EXISTS', message: 'Sản phẩm đã phát sinh đơn hàng, không thể xóa' });
          continue;
        }

        await client.query(`DELETE FROM products WHERE id = $1;`, [id]);
        deleted_ids.push(id);
      } catch (err) {
        failed.push({ id, code: 'ERROR', message: err.message });
      }
    }

    return { deleted_ids, failed };
  }

  // --- Reviews (REV01, REV02) ---

  async checkReviewEligibility(productId, userId, client = this.db) {
    if (!userId) {
      return {
        can_review: false,
        reason: 'not_logged_in',
        message: 'Bạn cần đăng nhập để đánh giá sản phẩm.',
      };
    }

    // Mỗi khách chỉ được đánh giá một sản phẩm một lần
    const existing = await client.query(
      `SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2 LIMIT 1;`,
      [productId, userId],
    );
    if (existing.rowCount > 0) {
      return {
        can_review: false,
        reason: 'already_reviewed',
        review_id: existing.rows[0].id,
        message: 'Bạn đã đánh giá sản phẩm này. Mỗi sản phẩm chỉ được đánh giá một lần.',
      };
    }

    // Kiểm tra các đơn hàng của khách hàng có chứa sản phẩm này
    const orderQuery = `
      SELECT o.id, o.code, o.status, o.status_label
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1 
        AND (oi.product_id = $2 OR oi.product_id::text = $2::text)
      ORDER BY 
        CASE 
          WHEN o.status IN ('completed', 'delivered') THEN 1
          WHEN o.status IN ('shipping', 'processing', 'confirmed', 'pending') THEN 2
          ELSE 3
        END ASC,
        o.created_at DESC;
    `;
    const orderRes = await client.query(orderQuery, [userId, productId]);

    if (orderRes.rowCount === 0) {
      return {
        can_review: false,
        reason: 'not_purchased',
        message: 'Bạn cần mua sản phẩm này và nhận hàng thành công để có thể viết đánh giá.',
      };
    }

    const hasDelivered = orderRes.rows.some((row) =>
      ['completed', 'delivered'].includes(row.status)
    );

    if (!hasDelivered) {
      return {
        can_review: false,
        reason: 'not_delivered',
        message: 'Đơn hàng của bạn đang được giao hoặc xử lý. Bạn chỉ có thể đánh giá sau khi nhận hàng thành công.',
      };
    }

    return {
      can_review: true,
      reason: 'eligible',
      message: 'Bạn đủ điều kiện để đánh giá sản phẩm này.',
    };
  }

  async getReviews(productId, { page = 1, limit = 20, userId = null } = {}, client = this.db) {
    const offset = (Math.max(1, page) - 1) * limit;

    const countQuery = `
      SELECT COUNT(*)::int AS total,
             COALESCE(ROUND(AVG(rating)::numeric, 1), 5.0) AS avg_rating
      FROM reviews
      WHERE product_id = $1;
    `;
    const countRes = await client.query(countQuery, [productId]);
    const total = countRes.rows[0]?.total || 0;
    const averageRating = parseFloat(countRes.rows[0]?.avg_rating) || 5.0;

    const query = `
      SELECT r.id, r.product_id, r.rating, r.content, r.images, r.created_at,
             u.id AS user_id, u.name AS user_name
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await client.query(query, [productId, limit, offset]);

    const reviews = result.rows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      author: {
        id: r.user_id || 'anonymous',
        name: r.user_name || 'Khách hàng',
      },
      rating: Number(r.rating),
      content: r.content || '',
      images: Array.isArray(r.images) ? r.images : [],
      created_at: r.created_at,
    }));

    let user_eligibility = null;
    if (userId) {
      user_eligibility = await this.checkReviewEligibility(productId, userId, client);
    }

    return {
      reviews,
      summary: {
        average_rating: averageRating,
        review_count: total,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
      user_eligibility,
    };
  }

  async createReview(productId, userId, { rating, content = '', image_ids = [] }, client = this.db) {
    // Chỉ cho phép đánh giá khi khách đã mua hàng và nhận hàng thành công
    const eligibility = await this.checkReviewEligibility(productId, userId, client);
    if (!eligibility.can_review) {
      const ErrorType = eligibility.reason === 'already_reviewed' ? ConflictError : ForbiddenError;
      throw Object.assign(new ErrorType(eligibility.message), { reason: eligibility.reason || 'NOT_ELIGIBLE' });
    }

    // Resolve image URLs from uploads if image_ids are provided
    let images = [];
    if (Array.isArray(image_ids) && image_ids.length > 0) {
      const imgRes = await client.query(`
        SELECT id, url FROM uploads WHERE id = ANY($1::uuid[])
      `, [image_ids]);
      images = imgRes.rows.map((row) => ({ id: row.id, url: row.url }));
    }

    const query = `
      INSERT INTO reviews (product_id, user_id, rating, content, images)
      SELECT $1::uuid, $2::uuid, $3::int, $4::text, $5::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE product_id = $1::uuid AND user_id = $2::uuid)
      ON CONFLICT DO NOTHING
      RETURNING id, product_id, rating, content, images, created_at;
    `;
    const result = await client.query(query, [
      productId,
      userId,
      Number(rating),
      content.trim().slice(0, 1000),
      JSON.stringify(images),
    ]);

    // Hai yêu cầu gửi gần như cùng lúc: yêu cầu sau không chèn được dòng nào
    if (result.rowCount === 0) {
      throw Object.assign(
        new ConflictError('Bạn đã đánh giá sản phẩm này. Mỗi sản phẩm chỉ được đánh giá một lần.'),
        { reason: 'already_reviewed' },
      );
    }
    const newRev = result.rows[0];
    const userRes = await client.query(`SELECT id, name FROM users WHERE id = $1;`, [userId]);
    const author = userRes.rows[0] || { id: userId, name: 'Khách hàng' };

    const countRes = await client.query(`
      SELECT COUNT(*)::int AS total,
             COALESCE(ROUND(AVG(rating)::numeric, 1), 5.0) AS avg_rating
      FROM reviews
      WHERE product_id = $1;
    `, [productId]);

    return {
      review: {
        id: newRev.id,
        product_id: newRev.product_id,
        author: {
          id: author.id,
          name: author.name,
        },
        rating: Number(newRev.rating),
        content: newRev.content,
        images: Array.isArray(newRev.images) ? newRev.images : [],
        created_at: newRev.created_at,
      },
      summary: {
        average_rating: parseFloat(countRes.rows[0]?.avg_rating) || 5.0,
        review_count: countRes.rows[0]?.total || 1,
      },
    };
  }

  // --- Uploads (REV03, ADP07) ---

  async createUpload({ url, file_name, mime_type, size_bytes, purpose }, client = this.db) {
    const query = `
      INSERT INTO uploads (url, file_name, mime_type, size_bytes, purpose)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, url, file_name, mime_type, size_bytes, purpose, created_at;
    `;
    const result = await client.query(query, [
      url,
      file_name,
      mime_type || 'image/jpeg',
      Number(size_bytes) || 0,
      purpose || 'review',
    ]);
    return result.rows[0];
  }
}

export const catalogRepository = new CatalogRepository();
export default catalogRepository;
