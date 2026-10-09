import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Khởi tạo Pool kết nối tới PostgreSQL
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'shop_db',
    });

// Hàm kiểm tra kết nối và khởi tạo bảng users với UUID & rf_token
export const initDB = async () => {
  try {
    const client = await pool.connect();
    console.log('📦 Kết nối PostgreSQL thành công!');

    // Kích hoạt extension pgcrypto để hỗ trợ gen_random_uuid()
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Kiểm tra xem bảng users đã tồn tại và cột id có phải là uuid chưa
    const checkIdTypeQuery = `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id';
    `;
    const checkRes = await client.query(checkIdTypeQuery);

    if (checkRes.rows.length > 0 && checkRes.rows[0].data_type !== 'uuid') {
      console.log('🔄 Chuyển đổi bảng users sang khóa chính UUID...');
      await client.query(`DROP TABLE IF EXISTS users CASCADE;`);
    }

    // Tạo bảng users với id UUID và trường rf_token
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'customer',
        rf_token TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createUsersTableQuery);

    // Đảm bảo các cột bổ sung cho users tồn tại nếu bảng đã có sẵn từ trước
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rf_token TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(25);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;`);

    // 2. Bảng sản phẩm (products)
    const createProductsTableQuery = `
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        price NUMERIC(15, 2) NOT NULL DEFAULT 0,
        old_price NUMERIC(15, 2),
        stock INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        images JSONB DEFAULT '[]'::jsonb,
        variants JSONB DEFAULT '[]'::jsonb,
        attributes JSONB DEFAULT '[]'::jsonb,
        featured BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        deposit BOOLEAN DEFAULT FALSE,
        deposit_rate NUMERIC(5, 2) DEFAULT 20,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
    `;
    await client.query(createProductsTableQuery);

    // 3. Bảng thanh toán (payments)
    const createPaymentsTableQuery = `
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR(100) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        amount NUMERIC(15, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'bank',
        payment_type VARCHAR(50) NOT NULL DEFAULT 'full',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        transaction_id VARCHAR(100),
        note TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    `;
    await client.query(createPaymentsTableQuery);

    // 4. Bảng tin nhắn chat (chat_messages)
    const createChatTableQuery = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id VARCHAR(100),
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        sender_name VARCHAR(100),
        owner VARCHAR(255) NOT NULL,
        sender_role VARCHAR(50) NOT NULL DEFAULT 'customer',
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chat_owner ON chat_messages(owner);
      CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
    `;
    await client.query(createChatTableQuery);

    // 5. Bảng thông tin cửa hàng (shop_settings)
    const createShopTableQuery = `
      CREATE TABLE IF NOT EXISTS shop_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL DEFAULT 'ABC Shop',
        description TEXT DEFAULT 'Cửa hàng trực tuyến',
        phone VARCHAR(50) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        address TEXT DEFAULT '',
        map_url TEXT DEFAULT '',
        logo_url TEXT DEFAULT '',
        banner_url TEXT DEFAULT '',
        social_links JSONB DEFAULT '[]'::jsonb,
        commerce JSONB DEFAULT '{"freeShippingFrom": 500000, "shippingFee": 30000, "depositRate": 0.2}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createShopTableQuery);

    // Thêm bản ghi mặc định cho shop_settings nếu chưa có
    await client.query(`
      INSERT INTO shop_settings (name, description, phone, email, address, map_url)
      SELECT 'ABC Shop', 'Cửa hàng trực tuyến', '0901234567', 'contact@abcshop.vn', '12 Nguyễn Trãi, Hà Nội', 'https://maps.google.com'
      WHERE NOT EXISTS (SELECT 1 FROM shop_settings);
    `);

    // 6. Bảng thông báo (notifications)
    const createNotificationsTableQuery = `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        owner VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        key VARCHAR(100),
        params JSONB DEFAULT '{}'::jsonb,
        type VARCHAR(50) DEFAULT 'system',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner);
    `;
    await client.query(createNotificationsTableQuery);

    console.log('✅ Hệ thống bảng (users, products, payments, chat, shop, notifications) đã sẵn sàng.');

    client.release();
  } catch (error) {
    console.error('❌ Lỗi kết nối PostgreSQL:', error.message);
  }
};

export default pool;
