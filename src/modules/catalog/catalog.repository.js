import pool from '../../config/db.js';

export class CatalogRepository {
  constructor(db = pool) {
    this.db = db;
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
      const err = new Error('Không thể xóa danh mục đang có sản phẩm');
      err.statusCode = 400;
      throw err;
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

  // Lấy mảng danh mục dạng chuỗi (hỗ trợ tương thích ngược)
  async getCategories(client = this.db) {
    const cats = await this.findAllCategories(client);
    if (cats.length > 0) return cats.map((c) => c.name);

    const query = `
      SELECT DISTINCT category
      FROM products
      WHERE category IS NOT NULL AND category != ''
      ORDER BY category ASC;
    `;
    const result = await client.query(query);
    return result.rows.map((r) => r.category);
  }

  // --- Customer Catalog (CAT01, CAT02) ---

  async findAllCustomer({
    keyword = '',
    category_id = '',
    min_price,
    max_price,
    in_stock,
    is_pinned,
    sort = 'newest',
    page = 1,
    limit = 20,
  } = {}, client = this.db) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = ['(p.active = TRUE)'];
    const values = [];

    if (keyword && keyword.trim()) {
      values.push(`%${keyword.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(p.name) LIKE $${values.length} OR LOWER(p.description) LIKE $${values.length})`);
    }

    if (category_id && category_id.trim()) {
      values.push(category_id.trim());
      conditions.push(`(p.category_id::text = $${values.length} OR LOWER(p.category) = LOWER($${values.length}))`);
    }

    if (in_stock !== undefined && in_stock !== null && in_stock !== '') {
      if (in_stock === true || in_stock === 'true') {
        conditions.push(`p.stock > 0`);
      }
    }

    if (is_pinned !== undefined && is_pinned !== null && is_pinned !== '') {
      values.push(is_pinned === true || is_pinned === 'true');
      conditions.push(`(p.is_pinned = $${values.length} OR p.featured = $${values.length})`);
    }

    if (min_price !== undefined && min_price !== null && min_price !== '') {
      values.push(Number(min_price));
      conditions.push(`p.price >= $${values.length}`);
    }

    if (max_price !== undefined && max_price !== null && max_price !== '') {
      values.push(Number(max_price));
      conditions.push(`p.price <= $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Order by: ưu tiên pinned lên đầu theo yêu cầu hợp đồng
    let sortClause = 'p.created_at DESC';
    if (sort === 'price_asc') sortClause = 'p.price ASC';
    else if (sort === 'price_desc') sortClause = 'p.price DESC';
    else if (sort === 'oldest') sortClause = 'p.created_at ASC';
    else if (sort === 'name_asc') sortClause = 'p.name ASC';
    else if (sort === 'name_desc') sortClause = 'p.name DESC';

    const orderBy = `COALESCE(p.is_pinned, p.featured, FALSE) DESC, ${sortClause}, p.id ASC`;

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
             COALESCE(p.is_pinned, p.featured, FALSE) AS is_pinned
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
    const conditions = [];
    const values = [];

    if (keyword && keyword.trim()) {
      values.push(`%${keyword.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(p.name) LIKE $${values.length} OR LOWER(p.description) LIKE $${values.length})`);
    }

    if (category_id && category_id.trim()) {
      values.push(category_id.trim());
      conditions.push(`(p.category_id::text = $${values.length} OR LOWER(p.category) = LOWER($${values.length}))`);
    }

    if (is_active !== undefined && is_active !== null && is_active !== '') {
      values.push(is_active === true || is_active === 'true');
      conditions.push(`p.active = $${values.length}`);
    }

    if (is_pinned !== undefined && is_pinned !== null && is_pinned !== '') {
      values.push(is_pinned === true || is_pinned === 'true');
      conditions.push(`(p.is_pinned = $${values.length} OR p.featured = $${values.length})`);
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

  // Hỗ trợ hàm findAll cũ cho các tests hiện có
  async findAll({
    page = 1,
    limit = 20,
    search = '',
    category = '',
    featured,
    active,
    minPrice,
    maxPrice,
    sort = 'newest',
  } = {}, client = this.db) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = [];
    const values = [];

    if (search && search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${values.length} OR LOWER(description) LIKE $${values.length})`);
    }

    if (category && category.trim()) {
      values.push(category.trim());
      conditions.push(`(category = $${values.length} OR category_id::text = $${values.length})`);
    }

    if (featured !== undefined && featured !== null && featured !== '') {
      values.push(featured === true || featured === 'true');
      conditions.push(`(featured = $${values.length} OR is_pinned = $${values.length})`);
    }

    if (active !== undefined && active !== null && active !== '') {
      values.push(active === true || active === 'true');
      conditions.push(`active = $${values.length}`);
    }

    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      values.push(Number(minPrice));
      conditions.push(`price >= $${values.length}`);
    }

    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      values.push(Number(maxPrice));
      conditions.push(`price <= $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'created_at DESC';
    if (sort === 'price_asc') orderBy = 'price ASC';
    else if (sort === 'price_desc') orderBy = 'price DESC';
    else if (sort === 'oldest') orderBy = 'created_at ASC';
    else if (sort === 'name_asc') orderBy = 'name ASC';
    else if (sort === 'name_desc') orderBy = 'name DESC';

    const countQuery = `SELECT COUNT(*) AS total FROM products ${whereClause};`;
    const countRes = await client.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT id, name, category, description, price, old_price AS "oldPrice", stock,
             image, images, variants, attributes, featured, active, deposit,
             deposit_rate AS "depositRate", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM products
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const dataRes = await client.query(dataQuery, values);

    return {
      products: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // --- Product Detail (CAT02, ADP02) ---

  async findById(id, client = this.db) {
    const query = `
      SELECT p.id, p.name, p.category, p.category_id, p.description,
             p.price, p.old_price AS "oldPrice", p.old_price, p.stock,
             p.image, p.images, p.variants, p.attributes,
             COALESCE(p.is_pinned, p.featured, FALSE) AS is_pinned,
             COALESCE(p.allow_deposit, p.deposit, FALSE) AS allow_deposit,
             COALESCE(p.deposit_rate, 20) AS deposit_rate,
             p.featured, p.active, p.deposit,
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

    let parsedImages = Array.isArray(raw.images) ? raw.images : [];
    if (typeof raw.images === 'string') {
      try { parsedImages = JSON.parse(raw.images); } catch {}
    }
    if (parsedImages.length === 0 && raw.image) {
      parsedImages = [{ id: '1', url: raw.image, alt_text: raw.name, sort_order: 1 }];
    }

    let parsedVariants = Array.isArray(raw.variants) ? raw.variants : [];
    if (typeof raw.variants === 'string') {
      try { parsedVariants = JSON.parse(raw.variants); } catch {}
    }

    let parsedAttributes = Array.isArray(raw.attributes) ? raw.attributes : [];
    if (typeof raw.attributes === 'string') {
      try { parsedAttributes = JSON.parse(raw.attributes); } catch {}
    }

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
      price: Number(raw.price),
      old_price: raw.old_price ? Number(raw.old_price) : null,
      stock_quantity: Number(raw.stock),
      is_pinned: Boolean(raw.is_pinned),
      is_active: Boolean(raw.active),
      allow_deposit: Boolean(raw.allow_deposit),
      deposit_rate: Number(raw.deposit_rate) || 20,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  // --- Create Product (ADP03) ---

  async create({
    name,
    category,
    category_id = null,
    description = '',
    price = 0,
    oldPrice,
    old_price = null,
    stock = 0,
    image = '',
    images = [],
    variants = [],
    attributes = [],
    featured = false,
    is_pinned = false,
    active = true,
    is_active = true,
    deposit = false,
    allow_deposit = false,
    depositRate,
    deposit_rate = 20,
  }, client = this.db) {
    const effectiveOldPrice = oldPrice !== undefined ? oldPrice : old_price;
    const effectiveDepositRate = depositRate !== undefined ? depositRate : deposit_rate;
    const effectivePinned = is_pinned !== undefined ? is_pinned : featured;
    const effectiveActive = is_active !== undefined ? is_active : active;
    const effectiveDeposit = allow_deposit !== undefined ? allow_deposit : deposit;

    // Tìm hoặc tạo category_id nếu chỉ có chuỗi category
    let finalCategoryId = category_id;
    let finalCategoryName = category;

    if (finalCategoryId && !finalCategoryName) {
      const cat = await this.findCategoryById(finalCategoryId, client);
      if (cat) finalCategoryName = cat.name;
    } else if (finalCategoryName && !finalCategoryId) {
      const cat = await this.findCategoryByName(finalCategoryName, client);
      if (cat) finalCategoryId = cat.id;
    }

    const query = `
      INSERT INTO products (
        name, category, category_id, description, price, old_price, stock, image, images,
        variants, attributes, featured, is_pinned, active, deposit, allow_deposit, deposit_rate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, name, category, category_id, description, price, old_price AS "oldPrice", stock,
                image, images, variants, attributes, featured, is_pinned, active, deposit, allow_deposit,
                deposit_rate AS "depositRate", created_at AS "createdAt", updated_at AS "updatedAt",
                created_at, updated_at;
    `;

    const values = [
      name,
      finalCategoryName || 'Mặc định',
      finalCategoryId || null,
      description,
      Number(price) || 0,
      effectiveOldPrice !== null && effectiveOldPrice !== undefined ? Number(effectiveOldPrice) : null,
      Number(stock) || 0,
      image,
      JSON.stringify(images || []),
      JSON.stringify(variants || []),
      JSON.stringify(attributes || []),
      Boolean(effectivePinned),
      Boolean(effectivePinned),
      Boolean(effectiveActive),
      Boolean(effectiveDeposit),
      Boolean(effectiveDeposit),
      Number(effectiveDepositRate) || 20,
    ];

    const result = await client.query(query, values);
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
      featured: 'featured',
      is_pinned: 'is_pinned',
      active: 'active',
      is_active: 'active',
      deposit: 'deposit',
      allow_deposit: 'allow_deposit',
      depositRate: 'deposit_rate',
      deposit_rate: 'deposit_rate',
    };

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      const col = columnMap[key];
      if (col && val !== undefined) {
        let value = val;
        if (['images', 'variants', 'attributes'].includes(col) && typeof val === 'object') {
          value = JSON.stringify(val);
        }
        values.push(value);
        setClauses.push(`${col} = $${values.length}`);

        // Đồng bộ đôi cột tương thích
        if (col === 'is_pinned') {
          values.push(value);
          setClauses.push(`featured = $${values.length}`);
        } else if (col === 'allow_deposit') {
          values.push(value);
          setClauses.push(`deposit = $${values.length}`);
        }
      }
    }

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

  async deleteMany(ids = [], client = this.db) {
    if (!ids || ids.length === 0) return 0;
    const query = `
      DELETE FROM products
      WHERE id = ANY($1::uuid[])
      RETURNING id;
    `;
    const result = await client.query(query, [ids]);
    return result.rowCount;
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
      const err = new Error(eligibility.message);
      err.statusCode = 403;
      err.reason = eligibility.reason;
      throw err;
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
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, product_id, rating, content, images, created_at;
    `;
    const result = await client.query(query, [
      productId,
      userId,
      Number(rating),
      content.trim().slice(0, 1000),
      JSON.stringify(images),
    ]);

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
