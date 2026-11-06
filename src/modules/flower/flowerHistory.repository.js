import pool from "../../config/db.js";

// Every query is scoped by user_id: a user can never read or delete another user's history.
const COLUMNS = `id, scientific_name, vietnamese_name, common_names, family,
  score, description, candidates, image_key, created_at`;

function toRecord(row) {
  return {
    id: row.id,
    scientificName: row.scientific_name,
    vietnameseName: row.vietnamese_name,
    commonNames: row.common_names || [],
    family: row.family,
    score: Number(row.score),
    description: { vi: "", en: "", ...(row.description || {}) },
    candidates: row.candidates || [],
    // The storage key stays server-side; clients only learn whether a photo exists.
    hasImage: Boolean(row.image_key),
    createdAt: row.created_at,
  };
}

export class FlowerHistoryRepository {
  constructor(db = pool) {
    this.db = db;
  }

  // Internal: storage key of a record photo, used to stream or delete it.
  async findImageKey(userId, id) {
    const { rows } = await this.db.query(
      "SELECT image_key FROM flower_identifications WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    return rows[0] ? rows[0].image_key : undefined;
  }

  // Saves the best match plus the full candidate list returned to the user.
  async create(userId, candidates, imageKey = null) {
    const [top] = candidates;
    const { rows } = await this.db.query(
      `INSERT INTO flower_identifications
         (user_id, scientific_name, vietnamese_name, common_names, family, score, description, candidates, image_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLUMNS}`,
      [
        userId,
        top.scientificName,
        top.vietnameseName || "",
        JSON.stringify(top.commonNames || []),
        top.family || "",
        top.score,
        JSON.stringify(top.description || { vi: "", en: "" }),
        JSON.stringify(
          candidates.map(({ scientificName, commonNames, family, score }) => ({
            scientificName,
            commonNames,
            family,
            score,
          })),
        ),
        imageKey,
      ],
    );
    return toRecord(rows[0]);
  }

  async list(userId, { page, limit }) {
    const offset = (page - 1) * limit;
    const [items, count] = await Promise.all([
      this.db.query(
        `SELECT ${COLUMNS} FROM flower_identifications
         WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
      this.db.query(
        "SELECT COUNT(*)::int AS total FROM flower_identifications WHERE user_id = $1",
        [userId],
      ),
    ]);
    const total = count.rows[0].total;
    return {
      items: items.rows.map(toRecord),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findById(userId, id) {
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM flower_identifications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  // Returns { imageKey } of the deleted row, or null when nothing matched.
  async remove(userId, id) {
    const { rows } = await this.db.query(
      "DELETE FROM flower_identifications WHERE id = $1 AND user_id = $2 RETURNING image_key",
      [id, userId],
    );
    return rows[0] ? { imageKey: rows[0].image_key } : null;
  }

  // Returns the storage keys of deleted photos so the caller can remove them.
  async clear(userId) {
    const { rows } = await this.db.query(
      "DELETE FROM flower_identifications WHERE user_id = $1 RETURNING image_key",
      [userId],
    );
    return { deleted: rows.length, imageKeys: rows.map((r) => r.image_key).filter(Boolean) };
  }
}

export default new FlowerHistoryRepository();
