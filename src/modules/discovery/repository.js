import pool from '../../config/db.js';

export class DiscoveryRepository {
  constructor(db = pool) { this.db = db; }

  async products() {
    const { rows } = await this.db.query(
      "SELECT p.id, p.name, p.description, p.category, p.image, p.price, p.old_price, p.stock, p.flower_species, p.is_pinned, p.featured, p.created_at " +
      "FROM products p WHERE p.active = TRUE AND p.stock > 0 AND p.price > 0 " +
      "AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.attributes) = 'array' THEN p.attributes ELSE '[]'::jsonb END) AS attr " +
      "WHERE COALESCE(attr->>'name', attr->>'label') IN ('visibility', '_visibility') AND COALESCE(attr->>'value', 'public') <> 'public') " +
      "ORDER BY p.created_at DESC, p.id ASC LIMIT 500"
    );
    return rows.map((p) => ({
      id: p.id, name: p.name, description: p.description || '', category: p.category,
      image_url: p.image || '', price: Number(p.price), old_price: p.old_price ? Number(p.old_price) : null,
      stock_quantity: Number(p.stock), flower_species: Array.isArray(p.flower_species) ? p.flower_species : [],
      is_pinned: Boolean(p.is_pinned || p.featured), created_at: p.created_at,
    }));
  }

  async preference(userId) {
    const { rows } = await this.db.query('SELECT consent, favorite_colors, favorite_themes FROM discovery_preferences WHERE user_id = $1', [userId]);
    const preference = rows[0];
    return preference?.consent ? preference : { consent: false, favorite_colors: [], favorite_themes: [] };
  }

  async updatePreference(userId, { consent, favorite_colors, favorite_themes }) {
    const client = this.db.connect ? await this.db.connect() : this.db;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO discovery_preferences (user_id, consent, favorite_colors, favorite_themes) VALUES ($1,$2,$3,$4) ' +
        'ON CONFLICT (user_id) DO UPDATE SET consent=$2, favorite_colors=$3, favorite_themes=$4, updated_at=NOW() ' +
        'RETURNING consent, favorite_colors, favorite_themes',
        [userId, consent, consent ? favorite_colors : [], consent ? favorite_themes : []]
      );
      if (!consent) await client.query('DELETE FROM discovery_interactions WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release?.(); }
  }

  async occasions(userId) {
    const { rows } = await this.db.query(
      'SELECT id, title, kind, month, day, reminder_days, enabled FROM discovery_occasions WHERE user_id=$1 ORDER BY month, day, id', [userId]
    );
    return rows;
  }
  async createOccasion(userId, value) {
    const { rows } = await this.db.query(
      'INSERT INTO discovery_occasions (user_id,title,kind,month,day,reminder_days,enabled) VALUES ($1,$2,$3,$4,$5,$6,$7) ' +
      'RETURNING id,title,kind,month,day,reminder_days,enabled',
      [userId, value.title, value.kind, value.month, value.day, value.reminder_days, value.enabled]
    );
    return rows[0];
  }
  async updateOccasion(userId, id, value) {
    const { rows } = await this.db.query(
      'UPDATE discovery_occasions SET title=$3,kind=$4,month=$5,day=$6,reminder_days=$7,enabled=$8 ' +
      'WHERE user_id=$1 AND id=$2 RETURNING id,title,kind,month,day,reminder_days,enabled',
      [userId, id, value.title, value.kind, value.month, value.day, value.reminder_days, value.enabled]
    );
    return rows[0] || null;
  }
  async deleteOccasion(userId, id) {
    const result = await this.db.query('DELETE FROM discovery_occasions WHERE user_id=$1 AND id=$2', [userId, id]);
    return result.rowCount > 0;
  }
  async interactions(userId) {
    const { rows } = await this.db.query(
      "SELECT product_id,action,theme_key FROM discovery_interactions WHERE user_id=$1 AND created_at > NOW() - INTERVAL '90 days' " +
      'ORDER BY created_at DESC LIMIT 200', [userId]
    );
    return rows;
  }
  async addInteraction(userId, { productId = null, action, themeKey = null }) {
    await this.db.query(
      'INSERT INTO discovery_interactions (user_id,product_id,action,theme_key) VALUES ($1,$2,$3,$4)',
      [userId, productId, action, themeKey]
    );
  }
  async clearHistory(userId) {
    await this.db.query('DELETE FROM discovery_interactions WHERE user_id=$1', [userId]);
  }
}

export default new DiscoveryRepository();
