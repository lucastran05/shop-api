import pool from '../config/db.js';

class UserModel {
  // Tìm người dùng theo Email
  static async findByEmail(email) {
    const query = `
      SELECT id, name, email, password, role, rf_token, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  // Tìm người dùng theo ID (UUID)
  static async findById(id) {
    const query = `
      SELECT id, name, email, role, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Tạo người dùng mới (id tự động tạo bằng UUID)
  static async create({ name, email, password, role = 'customer' }) {
    const query = `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at, updated_at;
    `;
    const values = [name, email, password, role];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Cập nhật rf_token cho người dùng
  static async updateRefreshToken(id, rf_token) {
    const query = `
      UPDATE users
      SET rf_token = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, email, role;
    `;
    const result = await pool.query(query, [rf_token, id]);
    return result.rows[0] || null;
  }

  // Tìm người dùng theo rf_token
  static async findByRefreshToken(rf_token) {
    const query = `
      SELECT id, name, email, role, rf_token
      FROM users
      WHERE rf_token = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [rf_token]);
    return result.rows[0] || null;
  }
}

export default UserModel;
