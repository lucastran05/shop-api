import pool from '../../config/db.js';
import { chatEvents } from './chat-events.js';

export class CommunicationRepository {
  constructor(db = pool) {
    this.db = db;
  }

  async getConversations(client = this.db) {
    const query = `
      SELECT DISTINCT ON (owner)
        id,
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
      ORDER BY owner, created_at DESC, id DESC;
    `;
    const result = await client.query(query);

    const unreadQuery = `
      SELECT owner, COUNT(*) AS unread_count
      FROM chat_messages
      WHERE is_read = FALSE AND sender_role = 'customer'
      GROUP BY owner;
    `;
    const unreadRes = await client.query(unreadQuery);
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

    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return conversations;
  }

  async findMessages({
    owner,
    conversation_id,
    page = 1,
    limit = 50,
    unread_only,
  } = {}, client = this.db) {
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
    const countRes = await client.query(countQuery, values);
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
    const dataRes = await client.query(dataQuery, values);

    return {
      messages: dataRes.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id, client = this.db) {
    const query = `
      SELECT id, conversation_id AS "conversationId", sender_id AS "senderId",
             sender_name AS "senderName", owner, sender_role AS "senderRole",
             sender_role AS "from", message, message AS text, is_read AS "isRead",
             created_at AS "createdAt", created_at AS at, updated_at AS "updatedAt"
      FROM chat_messages
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async create({
    owner,
    message,
    conversation_id = null,
    sender_id = null,
    sender_name = '',
    sender_role = 'customer',
  }, client = this.db) {
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

    const context = await this.getConversationContext(owner, client);
    const result = await client.query(query, values);
    const row = result.rows[0];
    chatEvents.emit('message', {
      customer: context.user,
      message: { id: row.id, conversation_id: row.conversationId, content: row.text, sender_role: row.senderRole, sender: { id: row.senderId, name: row.senderName }, is_read: row.isRead, created_at: row.createdAt },
    });
    return result.rows[0];
  }

  async markAsRead(id, client = this.db) {
    const query = `
      UPDATE chat_messages
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, owner, is_read AS "isRead";
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async markAllAsRead(owner, client = this.db) {
    const query = `
      UPDATE chat_messages
      SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE owner = $1 AND is_read = FALSE
      RETURNING id;
    `;
    const result = await client.query(query, [owner]);
    return result.rowCount;
  }

  async delete(id, client = this.db) {
    const query = `
      DELETE FROM chat_messages
      WHERE id = $1
      RETURNING id, owner;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async deleteConversation(owner, client = this.db) {
    const context = await this.getConversationContext(owner, client);
    const query = `
      DELETE FROM chat_messages
      WHERE owner = ANY($1::text[]) OR conversation_id = ANY($1::text[])
      RETURNING id;
    `;
    const result = await client.query(query, [context.keys]);
    if (result.rowCount) chatEvents.emit('removed', { customer: context.user, ids: result.rows.map(row => row.id) });
    return result.rowCount;
  }

  async getConversationContext(conversationId, client = this.db) {
    const raw = String(conversationId || '').trim();
    const userRes = await client.query(
      `SELECT id::text AS id, name, email
       FROM users
       WHERE id::text = $1 OR LOWER(email) = LOWER($1)
       LIMIT 1;`,
      [raw],
    );
    const user = userRes.rows[0] || null;
    const keys = [...new Set([raw, user?.id, user?.email].filter(Boolean))];
    return { raw, keys, user };
  }

  async getStoredConversationKey(conversationId, client = this.db) {
    const context = await this.getConversationContext(conversationId, client);
    const result = await client.query(
      `SELECT owner AS key
       FROM chat_messages
       WHERE owner = ANY($1::text[]) OR conversation_id = ANY($1::text[])
       ORDER BY created_at DESC, id DESC
       LIMIT 1;`,
      [context.keys],
    );
    return result.rows[0]?.key || context.user?.id || context.raw;
  }

  // --- CHAT01: Mở chat hoặc lấy hội thoại của khách ---

  async getOrCreateCustomerConversation(user, client = this.db) {
    const context = await this.getConversationContext(user.id, client);
    const lastMsgRes = await client.query(`
      SELECT id, message AS content, sender_role, created_at
      FROM chat_messages
      WHERE owner = ANY($1::text[]) OR conversation_id = ANY($1::text[])
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    `, [context.keys]);
    const lastMessage = lastMsgRes.rows[0] || null;
    return {
      id: user.id,
      customer: { id: user.id, name: user.name, email: user.email },
      last_message: lastMessage,
      created_at: lastMessage?.created_at || new Date().toISOString(),
    };
  }

  // --- CHAT02 / ADM02: Lấy tin nhắn theo conversation_id ---

  async getMessagesByConversation(conversationId, { cursor, limit = 50, after_id } = {}, client = this.db) {
    const context = await this.getConversationContext(conversationId, client);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const conditions = ['(owner = ANY($1::text[]) OR conversation_id = ANY($1::text[]))'];
    const values = [context.keys];
    if (after_id) {
      const afterRes = await client.query(`
        SELECT id, created_at FROM chat_messages
        WHERE id::text = $1
          AND (owner = ANY($2::text[]) OR conversation_id = ANY($2::text[]));
      `, [after_id, context.keys]);
      const boundary = afterRes.rows[0];
      if (!boundary) { const error = new Error('Invalid message boundary'); error.statusCode = 400; throw error; }
      values.push(boundary.created_at, boundary.id);
      conditions.push('(created_at, id) > ($' + (values.length - 1) + ', $' + values.length + '::uuid)');
    }
    if (cursor) {
      let boundary;
      try { boundary = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch {}
      if (boundary && typeof boundary.created_at === 'string' && !Number.isNaN(Date.parse(boundary.created_at)) &&
          typeof boundary.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(boundary.id)) {
        values.push(boundary.created_at, boundary.id);
        conditions.push('(created_at, id) < ($' + (values.length - 1) + ', $' + values.length + '::uuid)');
      } else if (!Number.isNaN(Date.parse(cursor))) {
        values.push(cursor);
        conditions.push('created_at < $' + values.length);
      } else { const error = new Error('Invalid message cursor'); error.statusCode = 400; throw error; }
    }
    values.push(limitNum + 1);
    const direction = after_id ? 'ASC' : 'DESC';
    const query = [
      'SELECT id, COALESCE(conversation_id, owner) AS conversation_id, message AS content,',
      '       sender_role, sender_id, sender_name, is_read, created_at',
      'FROM chat_messages',
      'WHERE ' + conditions.join(' AND '),
      'ORDER BY created_at ' + direction + ', id ' + direction,
      'LIMIT $' + values.length + ';',
    ].join('\n');
    const res = await client.query(query, values);
    const hasMore = res.rows.length > limitNum;
    const pageRows = res.rows.slice(0, limitNum);
    const rows = after_id ? pageRows : pageRows.reverse();
    const boundary = after_id ? rows.at(-1) : rows[0];
    const nextCursor = hasMore && boundary ? Buffer.from(JSON.stringify({ created_at: boundary.created_at, id: boundary.id })).toString('base64url') : null;
    const messages = rows.map((r) => ({
      id: r.id, conversation_id: r.conversation_id, content: r.content,
      sender_role: r.sender_role, is_read: r.is_read,
      sender: { id: r.sender_id || null, name: r.sender_name || (r.sender_role === 'shop' ? 'ABC Shop' : 'Khách hàng') },
      created_at: r.created_at,
    }));
    return {
      messages,
      customer: context.user || { id: context.raw, name: 'Khách hàng', email: '' },
      pagination: { next_cursor: hasMore ? nextCursor : null, has_more: hasMore },
    };
  }

  // --- CHAT03 / ADM03: Gửi tin nhắn vào cuộc hội thoại ---

  async sendConversationMessage(conversationId, senderUser, { content, client_message_id, sender_role = 'customer' }, client = this.db) {
    if (typeof content !== 'string' || !content.trim() || content.length > 2000) {
      const err = new Error('Nội dung tin nhắn phải có từ 1 đến 2000 ký tự');
      err.statusCode = 400;
      throw err;
    }
    const context = await this.getConversationContext(conversationId, client);
    const storedKey = await this.getStoredConversationKey(conversationId, client);
    const query = `
      INSERT INTO chat_messages (
        owner, conversation_id, sender_id, sender_name, sender_role, message
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, conversation_id, message AS content, sender_role, sender_id, sender_name, is_read, created_at;
    `;
    const res = await client.query(query, [
      storedKey, storedKey, senderUser.id,
      senderUser.name || (sender_role === 'shop' ? 'ABC Shop' : 'Khách hàng'),
      sender_role, content.trim(),
    ]);
    const row = res.rows[0];
    const result = {
      message: {
        id: row.id,
        conversation_id: row.conversation_id || storedKey,
        content: row.content,
        sender_role: row.sender_role,
        is_read: row.is_read,
        sender: { id: row.sender_id, name: row.sender_name },
        created_at: row.created_at,
        client_message_id: client_message_id || null,
      },
      customer: context.user,
    };
    chatEvents.emit('message', result);
    return result;
  }

  async markConversationAsRead(conversationId, email, client = this.db) {
    const context = await this.getConversationContext(conversationId, client);
    if (email && !context.keys.includes(email)) context.keys.push(email);
    const result = await client.query(
      `UPDATE chat_messages
       SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE sender_role IN ('shop', 'staff', 'admin', 'manager')
         AND is_read = FALSE
         AND (owner = ANY($1::text[]) OR conversation_id = ANY($1::text[]))
       RETURNING id;`,
      [context.keys],
    );
    return { updatedCount: result.rowCount };
  }

  // --- ADM01: Quản trị lấy danh sách hội thoại ---

  async getAdminConversationsList({ keyword = '', page = 1, limit = 20 } = {}, client = this.db) {
    const rawConversations = await this.getConversations(client);

    // Lấy thêm thông tin customer từ users
    let results = [];
    for (const c of rawConversations) {
      const uRes = await client.query(`SELECT id, name, email FROM users WHERE id::text = $1 OR email = $1;`, [c.owner]);
      const customer = uRes.rows[0] || {
        id: c.owner,
        name: c.senderName || 'Khách hàng',
        email: c.owner.includes('@') ? c.owner : '',
      };

      if (keyword && keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const matchesName = customer.name.toLowerCase().includes(kw);
        const matchesEmail = customer.email.toLowerCase().includes(kw);
        if (!matchesName && !matchesEmail) continue;
      }

      results.push({
        id: c.conversationId || c.owner,
        customer,
        last_message: {
          id: c.lastMessage.id,
          content: c.lastMessage.message || c.lastMessage.text || '',
          sender_role: c.lastMessage.senderRole || c.lastMessage.from || 'customer',
          created_at: c.lastMessage.at || c.updatedAt,
        },
        updated_at: c.updatedAt,
      });
    }

    const total = results.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;
    const paged = results.slice(offset, offset + limitNum);

    return {
      conversations: paged,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }
}

export const communicationRepository = new CommunicationRepository();
export default communicationRepository;
