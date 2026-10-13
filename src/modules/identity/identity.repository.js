import pool from '../../config/db.js';
import { hashToken } from '../../utils/jwt.js';

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

export class IdentityRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async findByEmail(email, client = this.db) {
    if (!email) return null;
    const query = `
      SELECT id, name, email, password, role, phone, address, avatar, active, rf_token, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const result = await client.query(query, [email.trim()]);
    return result.rows[0] || null;
  }

  async findById(id, client = this.db) {
    if (!id) return null;
    const query = `
      SELECT id, name, email, role, phone, address, avatar, active, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAll({ page = 1, limit = 20, search = '', role = '', active } = {}, client = this.db) {
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

    const countQuery = `SELECT COUNT(*) AS total FROM users ${whereClause};`;
    const countRes = await client.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

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
    const dataRes = await client.query(dataQuery, values);

    return {
      users: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async create({
    name,
    email,
    password,
    role = 'customer',
    phone = null,
    address = null,
    avatar = null,
    active = true,
  }, client = this.db) {
    const query = `
      INSERT INTO users (name, email, password, role, phone, address, avatar, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, role, phone, address, avatar, active, created_at, updated_at;
    `;
    const values = [name, email.toLowerCase().trim(), password, role, phone, address, avatar, active];
    const result = await client.query(query, values);
    return result.rows[0];
  }

  async update(id, fields = {}, client = this.db) {
    if (!id) return null;
    const validKeys = Object.keys(fields).filter((k) => ALLOWED_UPDATE_FIELDS.includes(k));
    if (validKeys.length === 0) return await this.findById(id, client);

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

    const result = await client.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id, client = this.db) {
    if (!id) return null;
    const query = `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, name, email;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async updateRefreshToken(id, rf_token, client = this.db) {
    if (!id) return null;
    const hashedToken = rf_token ? hashToken(rf_token) : null;
    const query = `
      UPDATE users
      SET rf_token = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, email, role, active;
    `;
    const result = await client.query(query, [hashedToken, id]);
    return result.rows[0] || null;
  }

  async findByRefreshToken(rf_token, client = this.db) {
    if (!rf_token || typeof rf_token !== 'string') return null;
    const hashedToken = hashToken(rf_token);
    const query = `
      SELECT id, name, email, role, active, rf_token
      FROM users
      WHERE rf_token = $1 OR rf_token = $2
      LIMIT 1;
    `;
    const result = await client.query(query, [hashedToken, rf_token.trim()]);
    return result.rows[0] || null;
  }

  async getAddresses(userId, client = this.db) {
    const query = `
      SELECT id, recipient_name, recipient_phone, province_code, province_name,
             ward_code, ward_name, street_address, full_address, is_default,
             created_at, updated_at
      FROM user_addresses
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC;
    `;
    const result = await client.query(query, [userId]);
    return result.rows;
  }

  async getAddressById(addressId, userId, client = this.db) {
    const query = `
      SELECT id, recipient_name, recipient_phone, province_code, province_name,
             ward_code, ward_name, street_address, full_address, is_default,
             created_at, updated_at
      FROM user_addresses
      WHERE id = $1 AND user_id = $2
      LIMIT 1;
    `;
    const result = await client.query(query, [addressId, userId]);
    return result.rows[0] || null;
  }

  async createAddress(userId, {
    recipient_name,
    recipient_phone,
    province_code,
    province_name,
    ward_code,
    ward_name,
    street_address,
    full_address,
    is_default = false,
  }, client = this.db) {
    if (is_default) {
      await client.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1;`, [userId]);
    }

    const query = `
      INSERT INTO user_addresses (
        user_id, recipient_name, recipient_phone, province_code, province_name,
        ward_code, ward_name, street_address, full_address, is_default
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, recipient_name, recipient_phone, province_code, province_name,
                ward_code, ward_name, street_address, full_address, is_default,
                created_at, updated_at;
    `;
    const values = [
      userId,
      recipient_name,
      recipient_phone,
      province_code,
      province_name,
      ward_code,
      ward_name,
      street_address,
      full_address,
      Boolean(is_default),
    ];
    const result = await client.query(query, values);
    const newAddress = result.rows[0];

    if (is_default) {
      await client.query(`UPDATE users SET default_address_id = $1 WHERE id = $2;`, [newAddress.id, userId]);
    }

    return newAddress;
  }

  async updateAddress(addressId, userId, fields = {}, client = this.db) {
    const existing = await this.getAddressById(addressId, userId, client);
    if (!existing) return null;

    if (fields.is_default) {
      await client.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1;`, [userId]);
      await client.query(`UPDATE users SET default_address_id = $1 WHERE id = $2;`, [addressId, userId]);
    }

    const allowed = [
      'recipient_name', 'recipient_phone', 'province_code', 'province_name',
      'ward_code', 'ward_name', 'street_address', 'full_address', 'is_default'
    ];

    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key) && val !== undefined) {
        values.push(val);
        setClauses.push(`${key} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) return existing;

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(addressId);
    values.push(userId);

    const query = `
      UPDATE user_addresses
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length - 1} AND user_id = $${values.length}
      RETURNING id, recipient_name, recipient_phone, province_code, province_name,
                ward_code, ward_name, street_address, full_address, is_default,
                created_at, updated_at;
    `;
    const result = await client.query(query, values);
    return result.rows[0] || null;
  }

  async deleteAddress(addressId, userId, client = this.db) {
    const query = `
      DELETE FROM user_addresses
      WHERE id = $1 AND user_id = $2
      RETURNING id, is_default;
    `;
    const result = await client.query(query, [addressId, userId]);
    if (result.rows.length === 0) return null;

    const deleted = result.rows[0];
    let defaultAddressId = null;

    if (deleted.is_default) {
      // Tìm địa chỉ gần nhất gán làm mặc định mới nếu còn
      const fallback = await client.query(`
        SELECT id FROM user_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;
      `, [userId]);
      if (fallback.rows.length > 0) {
        defaultAddressId = fallback.rows[0].id;
        await client.query(`UPDATE user_addresses SET is_default = TRUE WHERE id = $1;`, [defaultAddressId]);
        await client.query(`UPDATE users SET default_address_id = $1 WHERE id = $2;`, [defaultAddressId, userId]);
      } else {
        await client.query(`UPDATE users SET default_address_id = NULL WHERE id = $1;`, [userId]);
      }
    } else {
      const userRes = await client.query(`SELECT default_address_id FROM users WHERE id = $1;`, [userId]);
      defaultAddressId = userRes.rows[0]?.default_address_id || null;
    }

    return {
      deleted_id: addressId,
      default_address_id: defaultAddressId,
    };
  }

  async setDefaultAddress(addressId, userId, client = this.db) {
    const existing = await this.getAddressById(addressId, userId, client);
    if (!existing) return null;

    await client.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1;`, [userId]);
    await client.query(`UPDATE user_addresses SET is_default = TRUE WHERE id = $1 AND user_id = $2;`, [addressId, userId]);
    await client.query(`UPDATE users SET default_address_id = $1 WHERE id = $2;`, [addressId, userId]);

    return {
      id: addressId,
      is_default: true,
      default_address_id: addressId,
    };
  }

  async updatePassword(userId, newHashedPassword, client = this.db) {
    const query = `
      UPDATE users
      SET password = $1, rf_token = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, updated_at;
    `;
    const result = await client.query(query, [newHashedPassword, userId]);
    return result.rows[0] || null;
  }
}

export const identityRepository = new IdentityRepository();
export default identityRepository;
