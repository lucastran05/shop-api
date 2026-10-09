import pool from '../config/db.js';

class ShopModel {
  // Lấy cấu hình thông tin cửa hàng hiện tại (lấy bản ghi đầu tiên)
  static async getShop() {
    const query = `
      SELECT id, name, description, phone, email, address,
             map_url AS "mapUrl", logo_url AS "logoUrl", banner_url AS "bannerUrl",
             social_links AS "socialLinks", commerce,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM shop_settings
      ORDER BY created_at ASC
      LIMIT 1;
    `;
    const result = await pool.query(query);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      phone: row.phone,
      email: row.email,
      address: row.address,
      mapUrl: row.mapUrl,
      logoUrl: row.logoUrl,
      bannerUrl: row.bannerUrl,
      contact: {
        phone: row.phone,
        email: row.email,
        address: row.address,
        mapUrl: row.mapUrl,
        socialLinks: row.socialLinks || [],
      },
      commerce: row.commerce || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // Tạo cấu hình shop nếu chưa có
  static async create({
    name = 'ABC Shop',
    description = 'Cửa hàng trực tuyến',
    phone = '',
    email = '',
    address = '',
    map_url = '',
    mapUrl = '',
    logo_url = '',
    logoUrl = '',
    banner_url = '',
    bannerUrl = '',
    social_links = [],
    socialLinks = [],
    commerce = {},
  }) {
    const query = `
      INSERT INTO shop_settings (
        name, description, phone, email, address, map_url,
        logo_url, banner_url, social_links, commerce
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, description, phone, email, address,
                map_url AS "mapUrl", logo_url AS "logoUrl", banner_url AS "bannerUrl",
                social_links AS "socialLinks", commerce,
                created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const values = [
      name,
      description,
      phone,
      email,
      address,
      map_url || mapUrl || '',
      logo_url || logoUrl || '',
      banner_url || bannerUrl || '',
      JSON.stringify(social_links.length ? social_links : socialLinks),
      JSON.stringify(commerce),
    ];

    const result = await pool.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      phone: row.phone,
      email: row.email,
      address: row.address,
      mapUrl: row.mapUrl,
      logoUrl: row.logoUrl,
      bannerUrl: row.bannerUrl,
      contact: {
        phone: row.phone,
        email: row.email,
        address: row.address,
        mapUrl: row.mapUrl,
        socialLinks: row.socialLinks || [],
      },
      commerce: row.commerce || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // Cập nhật thông tin cửa hàng
  static async update(fields = {}) {
    // Trích xuất contact nếu được truyền dạng lồng nhau
    const contact = fields.contact || {};
    const name = fields.name !== undefined ? fields.name : undefined;
    const description = fields.description !== undefined ? fields.description : undefined;
    const phone = fields.phone !== undefined ? fields.phone : contact.phone;
    const email = fields.email !== undefined ? fields.email : contact.email;
    const address = fields.address !== undefined ? fields.address : contact.address;
    const mapUrl = fields.mapUrl !== undefined ? fields.mapUrl : (fields.map_url !== undefined ? fields.map_url : contact.mapUrl);
    const logoUrl = fields.logoUrl !== undefined ? fields.logoUrl : fields.logo_url;
    const bannerUrl = fields.bannerUrl !== undefined ? fields.bannerUrl : fields.banner_url;
    const socialLinks = fields.socialLinks || fields.social_links || contact.socialLinks;
    const commerce = fields.commerce;

    const setClauses = [];
    const values = [];

    if (name !== undefined) {
      values.push(name);
      setClauses.push(`name = $${values.length}`);
    }
    if (description !== undefined) {
      values.push(description);
      setClauses.push(`description = $${values.length}`);
    }
    if (phone !== undefined) {
      values.push(phone);
      setClauses.push(`phone = $${values.length}`);
    }
    if (email !== undefined) {
      values.push(email);
      setClauses.push(`email = $${values.length}`);
    }
    if (address !== undefined) {
      values.push(address);
      setClauses.push(`address = $${values.length}`);
    }
    if (mapUrl !== undefined) {
      values.push(mapUrl);
      setClauses.push(`map_url = $${values.length}`);
    }
    if (logoUrl !== undefined) {
      values.push(logoUrl);
      setClauses.push(`logo_url = $${values.length}`);
    }
    if (bannerUrl !== undefined) {
      values.push(bannerUrl);
      setClauses.push(`banner_url = $${values.length}`);
    }
    if (socialLinks !== undefined) {
      values.push(JSON.stringify(socialLinks));
      setClauses.push(`social_links = $${values.length}`);
    }
    if (commerce !== undefined) {
      values.push(JSON.stringify(commerce));
      setClauses.push(`commerce = $${values.length}`);
    }

    if (setClauses.length === 0) return await ShopModel.getShop();

    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    // Cập nhật bản ghi đầu tiên hoặc chèn mới nếu chưa có
    const checkQuery = `SELECT id FROM shop_settings ORDER BY created_at ASC LIMIT 1;`;
    const checkRes = await pool.query(checkQuery);

    if (checkRes.rows.length === 0) {
      return await ShopModel.create(fields);
    }

    const shopId = checkRes.rows[0].id;
    values.push(shopId);

    const query = `
      UPDATE shop_settings
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, name, description, phone, email, address,
                map_url AS "mapUrl", logo_url AS "logoUrl", banner_url AS "bannerUrl",
                social_links AS "socialLinks", commerce,
                created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const result = await pool.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      phone: row.phone,
      email: row.email,
      address: row.address,
      mapUrl: row.mapUrl,
      logoUrl: row.logoUrl,
      bannerUrl: row.bannerUrl,
      contact: {
        phone: row.phone,
        email: row.email,
        address: row.address,
        mapUrl: row.mapUrl,
        socialLinks: row.socialLinks || [],
      },
      commerce: row.commerce || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // Khôi phục cài đặt mặc định
  static async resetToDefault() {
    await pool.query(`DELETE FROM shop_settings;`);
    return await ShopModel.create({
      name: 'ABC Shop',
      description: 'Cửa hàng trực tuyến',
      phone: '0901234567',
      email: 'contact@abcshop.vn',
      address: '12 Nguyễn Trãi, Hà Nội',
      mapUrl: 'https://maps.google.com',
      commerce: {
        freeShippingFrom: 500000,
        shippingFee: 30000,
        depositRate: 0.2,
      },
    });
  }
}

export default ShopModel;
