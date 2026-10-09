import pool from '../config/db.js';

class NotificationModel {
  // Lấy danh sách thông báo
  static async findAll({
    user_id = '',
    owner = '',
    type = '',
    unread_only,
    page = 1,
    limit = 20,
    recipientMatch = false,
  } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = [];
    const values = [];

    if (recipientMatch && (user_id || owner)) {
      const recipientOr = [];
      if (user_id && user_id.trim()) {
        values.push(user_id.trim());
        recipientOr.push(`user_id = $${values.length}`);
      }
      if (owner && owner.trim()) {
        values.push(owner.trim().toLowerCase());
        recipientOr.push(`LOWER(owner) = $${values.length}`);
      }
      recipientOr.push(`(user_id IS NULL AND (owner IS NULL OR owner = ''))`);
      conditions.push(`(${recipientOr.join(' OR ')})`);
    } else {
      if (user_id && user_id.trim()) {
        values.push(user_id.trim());
        conditions.push(`user_id = $${values.length}`);
      }
      if (owner && owner.trim()) {
        values.push(owner.trim().toLowerCase());
        conditions.push(`LOWER(owner) = $${values.length}`);
      }
    }

    if (type && type.trim()) {
      values.push(type.trim());
      conditions.push(`type = $${values.length}`);
    }

    if (unread_only === true || unread_only === 'true') {
      conditions.push(`is_read = FALSE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Đếm tổng số thông báo
    const countQuery = `SELECT COUNT(*) AS total FROM notifications ${whereClause};`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    // Đếm số thông báo chưa đọc
    const unreadConditions = conditions.filter((c) => c !== 'is_read = FALSE');
    unreadConditions.push('is_read = FALSE');
    const unreadWhereClause = `WHERE ${unreadConditions.join(' AND ')}`;
    const unreadCountQuery = `SELECT COUNT(*) AS unread FROM notifications ${unreadWhereClause};`;
    const unreadRes = await pool.query(unreadCountQuery, values);
    const unreadCount = parseInt(unreadRes.rows[0].unread, 10);

    // Lấy dữ liệu phân trang
    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT id, user_id AS "userId", owner, title, message, message AS text,
             key, params, type, is_read AS "isRead", is_read AS read,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const dataRes = await pool.query(dataQuery, values);

    return {
      notifications: dataRes.rows,
      total,
      unreadCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Lấy chi tiết thông báo theo ID
  static async findById(id) {
    const query = `
      SELECT id, user_id AS "userId", owner, title, message, message AS text,
             key, params, type, is_read AS "isRead", is_read AS read,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM notifications
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Tạo thông báo mới
  static async create({
    title,
    message,
    text,
    user_id = null,
    userId = null,
    owner = '',
    key = null,
    params = {},
    type = 'system',
  }) {
    const finalMessage = message || text || title;
    const finalUserId = user_id || userId || null;

    const query = `
      INSERT INTO notifications (
        user_id, owner, title, message, key, params, type, is_read
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
      RETURNING id, user_id AS "userId", owner, title, message, message AS text,
                key, params, type, is_read AS "isRead", is_read AS read,
                created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const values = [
      finalUserId,
      owner || '',
      title,
      finalMessage,
      key || null,
      JSON.stringify(params || {}),
      type || 'system',
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Đánh dấu một thông báo là đã đọc
  static async markAsRead(id) {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, user_id AS "userId", owner, is_read AS "isRead", is_read AS read;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Đánh dấu tất cả thông báo của user/owner là đã đọc
  static async markAllAsRead({ user_id = null, owner = null } = {}) {
    const conditions = [];
    const values = [];

    if (user_id) {
      values.push(user_id);
      conditions.push(`user_id = $${values.length}`);
    }

    if (owner) {
      values.push(owner.toLowerCase());
      conditions.push(`LOWER(owner) = $${values.length}`);
    }

    if (conditions.length === 0) {
      // Nếu không chỉ định, đánh dấu tất cả
      const query = `UPDATE notifications SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP WHERE is_read = FALSE RETURNING id;`;
      const result = await pool.query(query);
      return result.rowCount;
    }

    const query = `
      UPDATE notifications
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE (${conditions.join(' OR ')}) AND is_read = FALSE
      RETURNING id;
    `;
    const result = await pool.query(query, values);
    return result.rowCount;
  }

  // Xóa thông báo
  static async delete(id) {
    const query = `
      DELETE FROM notifications
      WHERE id = $1
      RETURNING id, title;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Xóa tất cả thông báo đã đọc
  static async clearRead({ user_id = null, owner = null } = {}) {
    const conditions = ['is_read = TRUE'];
    const values = [];

    const userConditions = [];
    if (user_id) {
      values.push(user_id);
      userConditions.push(`user_id = $${values.length}`);
    }

    if (owner) {
      values.push(owner.toLowerCase());
      userConditions.push(`LOWER(owner) = $${values.length}`);
    }

    if (userConditions.length > 0) {
      conditions.push(`(${userConditions.join(' OR ')})`);
    }

    const query = `
      DELETE FROM notifications
      WHERE ${conditions.join(' AND ')}
      RETURNING id;
    `;
    const result = await pool.query(query, values);
    return result.rowCount;
  }
}

export default NotificationModel;
