import pool from '../../config/db.js';

export class NotificationRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async findAll({
    user_id = '',
    owner = '',
    type = '',
    unread_only,
    page = 1,
    limit = 20,
    recipientMatch = false,
  } = {}, client = this.db) {
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

    const countQuery = `SELECT COUNT(*) AS total FROM notifications ${whereClause};`;
    const countRes = await client.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const unreadConditions = conditions.filter((c) => c !== 'is_read = FALSE');
    unreadConditions.push('is_read = FALSE');
    const unreadWhereClause = `WHERE ${unreadConditions.join(' AND ')}`;
    const unreadCountQuery = `SELECT COUNT(*) AS unread FROM notifications ${unreadWhereClause};`;
    const unreadRes = await client.query(unreadCountQuery, values);
    const unreadCount = parseInt(unreadRes.rows[0].unread, 10);

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
    const dataRes = await client.query(dataQuery, values);

    return {
      notifications: dataRes.rows,
      total,
      unreadCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id, client = this.db) {
    const query = `
      SELECT id, user_id AS "userId", owner, title, message, message AS text,
             key, params, type, is_read AS "isRead", is_read AS read,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM notifications
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async create({
    title,
    message,
    text,
    user_id = null,
    userId = null,
    owner = '',
    key = null,
    params = {},
    type = 'system',
  }, client = this.db) {
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

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async markAsRead(id, client = this.db) {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, user_id AS "userId", owner, is_read AS "isRead", is_read AS read;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async markAllAsRead({ user_id = null, owner = null } = {}, client = this.db) {
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
      const query = `UPDATE notifications SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP WHERE is_read = FALSE RETURNING id;`;
      const result = await client.query(query);
      return result.rowCount;
    }

    const query = `
      UPDATE notifications
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE (${conditions.join(' OR ')}) AND is_read = FALSE
      RETURNING id;
    `;
    const result = await client.query(query, values);
    return result.rowCount;
  }

  async delete(id, client = this.db) {
    const query = `
      DELETE FROM notifications
      WHERE id = $1
      RETURNING id, title;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async clearRead({ user_id = null, owner = null } = {}, client = this.db) {
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
    const result = await client.query(query, values);
    return result.rowCount;
  }

  // --- NOT01: Danh sách thông báo theo hợp đồng ---

  async getCustomerNotifications(userId, { page = 1, limit = 20 } = {}, client = this.db) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    const countRes = await client.query(`
      SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 OR user_id IS NULL;
    `, [userId]);
    const total = countRes.rows[0]?.total || 0;

    const unreadRes = await client.query(`
      SELECT COUNT(*)::int AS unread FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE;
    `, [userId]);
    const unreadCount = unreadRes.rows[0]?.unread || 0;

    const query = `
      SELECT id, title, message AS content, type, key AS target_type, params->>'target_id' AS target_id,
             is_read, created_at
      FROM notifications
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const dataRes = await client.query(query, [userId, limitNum, offset]);

    const items = dataRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type || 'system',
      target_type: row.target_type || null,
      target_id: row.target_id || null,
      is_read: Boolean(row.is_read),
      created_at: row.created_at,
    }));

    return {
      notifications: items,
      unread_count: unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  // --- NOT02: Đánh dấu một thông báo đã đọc ---

  async markSingleRead(notificationId, userId, client = this.db) {
    const updateRes = await client.query(`
      UPDATE notifications
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, is_read, updated_at AS read_at;
    `, [notificationId]);

    const unreadRes = await client.query(`
      SELECT COUNT(*)::int AS unread FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE;
    `, [userId]);

    return {
      notification: updateRes.rows[0] ? {
        id: updateRes.rows[0].id,
        is_read: true,
        read_at: updateRes.rows[0].read_at,
      } : { id: notificationId, is_read: true, read_at: new Date().toISOString() },
      unread_count: unreadRes.rows[0]?.unread || 0,
    };
  }

  // --- NOT03: Đánh dấu tất cả thông báo đã đọc ---

  async markAllCustomerRead(userId, client = this.db) {
    const updateRes = await client.query(`
      UPDATE notifications
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE
      RETURNING id;
    `, [userId]);

    return {
      updated_count: updateRes.rowCount,
      read_at: new Date().toISOString(),
      unread_count: 0,
    };
  }
}

export const notificationRepository = new NotificationRepository();
export default notificationRepository;
