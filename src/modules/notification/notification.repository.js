import pool from '../../config/db.js';
import { NotFoundError } from '../../common/errors/AppError.js';

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

  // --- NOT02: Đánh dấu một thông báo đã đọc ---

  async markSingleRead(notificationId, userId, client = this.db) {
    const updateRes = await client.query(`
      UPDATE notifications
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
      RETURNING id, is_read, updated_at AS read_at;
    `, [notificationId, userId]);

    const unreadRes = await client.query(`
      SELECT COUNT(*)::int AS unread FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE;
    `, [userId]);

    if (!updateRes.rows[0]) throw new NotFoundError('Không tìm thấy thông báo');

    return {
      notification: {
        id: updateRes.rows[0].id,
        is_read: true,
        read_at: updateRes.rows[0].read_at,
      },
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
