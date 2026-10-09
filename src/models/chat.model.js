import pool from '../config/db.js';

class ChatModel {
  // Lấy danh sách cuộc hội thoại (gom nhóm theo owner)
  static async getConversations() {
    const query = `
      SELECT DISTINCT ON (owner)
        owner,
        conversation_id,
        sender_name,
        message,
        message AS text,
        sender_role,
        sender_role AS "from",
        is_read,
        created_at,
        created_at AS at
      FROM chat_messages
      ORDER BY owner, created_at DESC;
    `;
    const result = await pool.query(query);

    // Lấy thêm số tin nhắn chưa đọc cho từng owner
    const unreadQuery = `
      SELECT owner, COUNT(*) AS unread_count
      FROM chat_messages
      WHERE is_read = FALSE AND sender_role = 'customer'
      GROUP BY owner;
    `;
    const unreadRes = await pool.query(unreadQuery);
    const unreadMap = {};
    unreadRes.rows.forEach((r) => {
      unreadMap[r.owner] = parseInt(r.unread_count, 10);
    });

    const conversations = result.rows.map((row) => ({
      owner: row.owner,
      conversationId: row.conversation_id,
      senderName: row.sender_name,
      lastMessage: {
        id: row.id,
        message: row.message,
        text: row.text,
        from: row.from,
        senderRole: row.sender_role,
        at: row.at,
        isRead: row.is_read,
      },
      unreadCount: unreadMap[row.owner] || 0,
      updatedAt: row.created_at,
    }));

    // Sắp xếp cuộc trò chuyện có tin nhắn mới nhất lên đầu
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return conversations;
  }

  // Lấy danh sách tin nhắn theo bộ lọc
  static async findMessages({
    owner,
    conversation_id,
    page = 1,
    limit = 50,
    unread_only,
  } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;
    const conditions = [];
    const values = [];

    if (owner && owner.trim()) {
      values.push(owner.trim());
      conditions.push(`owner = $${values.length}`);
    }

    if (conversation_id && conversation_id.trim()) {
      values.push(conversation_id.trim());
      conditions.push(`conversation_id = $${values.length}`);
    }

    if (unread_only === true || unread_only === 'true') {
      conditions.push(`is_read = FALSE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) AS total FROM chat_messages ${whereClause};`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const dataQuery = `
      SELECT id, conversation_id AS "conversationId", sender_id AS "senderId",
             sender_name AS "senderName", owner, sender_role AS "senderRole",
             sender_role AS "from", message, message AS text, is_read AS "isRead",
             created_at AS "createdAt", created_at AS at, updated_at AS "updatedAt"
      FROM chat_messages
      ${whereClause}
      ORDER BY created_at ASC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const dataRes = await pool.query(dataQuery, values);

    return {
      messages: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Lấy tin nhắn theo ID
  static async findById(id) {
    const query = `
      SELECT id, conversation_id AS "conversationId", sender_id AS "senderId",
             sender_name AS "senderName", owner, sender_role AS "senderRole",
             sender_role AS "from", message, message AS text, is_read AS "isRead",
             created_at AS "createdAt", created_at AS at, updated_at AS "updatedAt"
      FROM chat_messages
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Tạo tin nhắn mới
  static async create({
    owner,
    message,
    conversation_id = null,
    sender_id = null,
    sender_name = '',
    sender_role = 'customer',
  }) {
    const query = `
      INSERT INTO chat_messages (
        owner, message, conversation_id, sender_id, sender_name, sender_role
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId",
                sender_name AS "senderName", owner, sender_role AS "senderRole",
                sender_role AS "from", message, message AS text, is_read AS "isRead",
                created_at AS "createdAt", created_at AS at, updated_at AS "updatedAt";
    `;

    const values = [
      owner,
      message,
      conversation_id || owner,
      sender_id || null,
      sender_name || '',
      sender_role,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Đánh dấu một tin nhắn là đã đọc
  static async markAsRead(id) {
    const query = `
      UPDATE chat_messages
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, owner, is_read AS "isRead";
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Đánh dấu tất cả tin nhắn của owner là đã đọc
  static async markAllAsRead(owner) {
    const query = `
      UPDATE chat_messages
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE owner = $1 AND is_read = FALSE
      RETURNING id;
    `;
    const result = await pool.query(query, [owner]);
    return result.rowCount;
  }

  // Xóa tin nhắn
  static async delete(id) {
    const query = `
      DELETE FROM chat_messages
      WHERE id = $1
      RETURNING id, owner;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Xóa toàn bộ hội thoại của một owner
  static async deleteConversation(owner) {
    const query = `
      DELETE FROM chat_messages
      WHERE owner = $1
      RETURNING id;
    `;
    const result = await pool.query(query, [owner]);
    return result.rowCount;
  }
}

export default ChatModel;
