import pool from '../config/db.js';
import { hashToken } from '../utils/jwt.js';

// Danh sách các cột hợp lệ được phép cập nhật trong bảng users để ngăn chặn SQL Injection vào tên cột
const ALLOWED_UPDATE_FIELDS = [
  'name',
  'email',
  'password',
  'role',
  'phone',
  'address',
  'avatar',
  'active',
];

class UserModel {
  // Tìm người dùng theo Email
  static async findByEmail(email) {
    if (!email) return null;
    const query = `
      SELECT id, name, email, password, role, phone, address, avatar, active, rf_token, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const result = await pool.query(query, [email.trim()]);
    return result.rows[0] || null;
  }

  // Tìm người dùng theo ID (UUID) - không trả về rf_token và password
  static async findById(id) {
    if (!id) return null;
    const query = `
      SELECT id, name, email, role, phone, address, avatar, active, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Lấy danh sách người dùng có phân trang và bộ lọc
  static async findAll({ page = 1, limit = 20, search = '', role = '', active } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = [];
    const values = [];

    if (search && search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${values.length} OR LOWER(email) LIKE $${values.length})`);
    }

    if (role && role.trim()) {
      values.push(role.trim());
      conditions.push(`role = $${values.length}`);
    }

    if (active !== undefined && active !== null && active !== '') {
      values.push(active === true || active === 'true');
      conditions.push(`active = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Đếm tổng số bản ghi
    const countQuery = `SELECT COUNT(*) AS total FROM users ${whereClause};`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    // Lấy dữ liệu theo phân trang
    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT id, name, email, role, phone, address, avatar, active, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const dataRes = await pool.query(dataQuery, values);

    return {
      users: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Tạo người dùng mới (id tự động tạo bằng UUID)
  static async create({
    name,
    email,
    password,
    role = 'customer',
    phone = null,
    address = null,
    avatar = null,
    active = true,
  }) {
    const query = `
      INSERT INTO users (name, email, password, role, phone, address, avatar, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, role, phone, address, avatar, active, created_at, updated_at;
    `;
    const values = [name, email.toLowerCase().trim(), password, role, phone, address, avatar, active];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Cập nhật thông tin người dùng (bảo vệ bằng allowlist chống SQL injection)
  static async update(id, fields = {}) {
    if (!id) return null;
    const validKeys = Object.keys(fields).filter((k) => ALLOWED_UPDATE_FIELDS.includes(k));
    if (validKeys.length === 0) return await UserModel.findById(id);

    const setClauses = [];
    const values = [];

    validKeys.forEach((key, index) => {
      setClauses.push(`${key} = $${index + 1}`);
      values.push(fields[key]);
    });

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, name, email, role, phone, address, avatar, active, created_at, updated_at;
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Xóa người dùng theo ID
  static async delete(id) {
    if (!id) return null;
    const query = `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, name, email;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Cập nhật rf_token cho người dùng (lưu SHA-256 hash an toàn)
  static async updateRefreshToken(id, rf_token) {
    if (!id) return null;
    const hashedToken = rf_token ? hashToken(rf_token) : null;
    const query = `
      UPDATE users
      SET rf_token = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, email, role, active;
    `;
    const result = await pool.query(query, [hashedToken, id]);
    return result.rows[0] || null;
  }

  // Tìm người dùng theo rf_token (hỗ trợ cả hash SHA-256 và token thô cũ để tương thích ngược)
  static async findByRefreshToken(rf_token) {
    if (!rf_token || typeof rf_token !== 'string') return null;
    const hashedToken = hashToken(rf_token);
    const query = `
      SELECT id, name, email, role, active, rf_token
      FROM users
      WHERE rf_token = $1 OR rf_token = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [hashedToken, rf_token.trim()]);
    return result.rows[0] || null;
  }
}

export default UserModel;
