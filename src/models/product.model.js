import pool from '../config/db.js';

class ProductModel {
  // Lấy danh sách sản phẩm có phân trang, tìm kiếm, lọc danh mục, giá, trạng thái
  static async findAll({
    page = 1,
    limit = 20,
    search = '',
    category = '',
    featured,
    active,
    minPrice,
    maxPrice,
    sort = 'newest',
  } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = [];
    const values = [];

    if (search && search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${values.length} OR LOWER(description) LIKE $${values.length})`);
    }

    if (category && category.trim()) {
      values.push(category.trim());
      conditions.push(`category = $${values.length}`);
    }

    if (featured !== undefined && featured !== null && featured !== '') {
      values.push(featured === true || featured === 'true');
      conditions.push(`featured = $${values.length}`);
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

    // Sắp xếp
    let orderBy = 'created_at DESC';
    if (sort === 'price_asc') orderBy = 'price ASC';
    else if (sort === 'price_desc') orderBy = 'price DESC';
    else if (sort === 'oldest') orderBy = 'created_at ASC';
    else if (sort === 'name_asc') orderBy = 'name ASC';
    else if (sort === 'name_desc') orderBy = 'name DESC';

    // Đếm tổng số
    const countQuery = `SELECT COUNT(*) AS total FROM products ${whereClause};`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    // Lấy danh sách
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
    const dataRes = await pool.query(dataQuery, values);

    return {
      products: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Lấy chi tiết sản phẩm theo ID
  static async findById(id) {
    const query = `
      SELECT id, name, category, description, price, old_price AS "oldPrice", stock,
             image, images, variants, attributes, featured, active, deposit,
             deposit_rate AS "depositRate", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM products
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Lấy danh sách tất cả các danh mục sản phẩm (distinct)
  static async getCategories() {
    const query = `
      SELECT DISTINCT category
      FROM products
      WHERE category IS NOT NULL AND category != ''
      ORDER BY category ASC;
    `;
    const result = await pool.query(query);
    return result.rows.map((r) => r.category);
  }

  // Thêm mới sản phẩm
  static async create({
    name,
    category,
    description = '',
    price = 0,
    oldPrice = null,
    old_price = null,
    stock = 0,
    image = '',
    images = [],
    variants = [],
    attributes = [],
    featured = false,
    active = true,
    deposit = false,
    depositRate = 20,
    deposit_rate = 20,
  }) {
    const effectiveOldPrice = oldPrice !== undefined ? oldPrice : old_price;
    const effectiveDepositRate = depositRate !== undefined ? depositRate : deposit_rate;

    const query = `
      INSERT INTO products (
        name, category, description, price, old_price, stock, image, images,
        variants, attributes, featured, active, deposit, deposit_rate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, name, category, description, price, old_price AS "oldPrice", stock,
                image, images, variants, attributes, featured, active, deposit,
                deposit_rate AS "depositRate", created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const values = [
      name,
      category,
      description,
      Number(price) || 0,
      effectiveOldPrice !== null && effectiveOldPrice !== undefined ? Number(effectiveOldPrice) : null,
      Number(stock) || 0,
      image,
      JSON.stringify(images || []),
      JSON.stringify(variants || []),
      JSON.stringify(attributes || []),
      Boolean(featured),
      active !== undefined ? Boolean(active) : true,
      Boolean(deposit),
      Number(effectiveDepositRate) || 20,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Cập nhật sản phẩm
  static async update(id, fields = {}) {
    const columnMap = {
      name: 'name',
      category: 'category',
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
      active: 'active',
      deposit: 'deposit',
      depositRate: 'deposit_rate',
      deposit_rate: 'deposit_rate',
    };

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      const col = columnMap[key];
      if (col) {
        let value = val;
        if (['images', 'variants', 'attributes'].includes(col) && typeof val === 'object') {
          value = JSON.stringify(val);
        }
        values.push(value);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) return await ProductModel.findById(id);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE products
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, name, category, description, price, old_price AS "oldPrice", stock,
                image, images, variants, attributes, featured, active, deposit,
                deposit_rate AS "depositRate", created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Xóa một sản phẩm
  static async delete(id) {
    const query = `
      DELETE FROM products
      WHERE id = $1
      RETURNING id, name;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Xóa nhiều sản phẩm theo mảng ID
  static async deleteMany(ids = []) {
    if (!ids || ids.length === 0) return 0;
    const query = `
      DELETE FROM products
      WHERE id = ANY($1::uuid[])
      RETURNING id;
    `;
    const result = await pool.query(query, [ids]);
    return result.rowCount;
  }
}

export default ProductModel;
