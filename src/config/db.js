import pkg from 'pg';
const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;
const databasePassword = process.env.DB_PASSWORD;
if (isProduction && !databaseUrl && (!databasePassword || databasePassword === 'postgres')) {
  throw new Error('DB_PASSWORD or DATABASE_URL must be configured with a non-default value in production');
}

// Cấu hình tối ưu Connection Pool cho PostgreSQL
const poolConfig = {
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS) || 5000,
};

// Khởi tạo Pool kết nối tới PostgreSQL
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ...poolConfig,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: databasePassword || 'postgres',
      database: process.env.DB_NAME || 'shop_db',
      ...poolConfig,
    });

// Hàm kiểm tra kết nối và khởi tạo bảng users với UUID & rf_token
export const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('shop-api:schema', 0))");
    console.log('📦 Kết nối PostgreSQL thành công!');

    // Kích hoạt extension pgcrypto để hỗ trợ gen_random_uuid()
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Kiểm tra xem bảng users đã tồn tại và cột id có phải là uuid chưa
    const checkIdTypeQuery = `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'id';
    `;
    const checkRes = await client.query(checkIdTypeQuery);

    if (checkRes.rows.length > 0 && checkRes.rows[0].data_type !== 'uuid') {
      throw new Error('users.id is not UUID; migrate the existing schema explicitly. Automatic table deletion is disabled.');
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
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ;
    `);

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

    // 7. Bảng danh mục sản phẩm (categories)
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7b. Bảng voucher giảm giá
    await client.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
        discount_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
        min_order_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
        max_discount_amount NUMERIC(15, 2),
        usage_limit INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        starts_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT vouchers_discount_type_check CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
        CONSTRAINT vouchers_discount_value_check CHECK (discount_value >= 0),
        CONSTRAINT vouchers_min_order_check CHECK (min_order_amount >= 0),
        CONSTRAINT vouchers_usage_check CHECK (usage_limit IS NULL OR usage_limit >= 0),
        CONSTRAINT vouchers_used_count_check CHECK (used_count >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_vouchers_active_dates ON vouchers(active, starts_at, expires_at);
      CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
      ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'broadcast' CHECK (audience IN ('broadcast', 'selected'));
      ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recipient_ids UUID[] NOT NULL DEFAULT '{}';
    `);

    // 8. Bảng địa chỉ người dùng (user_addresses)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        recipient_name VARCHAR(255) NOT NULL,
        recipient_phone VARCHAR(50) NOT NULL,
        province_code VARCHAR(50) NOT NULL,
        province_name VARCHAR(255) NOT NULL,
        ward_code VARCHAR(50) NOT NULL,
        ward_name VARCHAR(255) NOT NULL,
        street_address TEXT NOT NULL,
        full_address TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_address_id UUID;
    `);

    // Cập nhật các cột bổ sung cho products nếu chưa có
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS flower_species JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(flower_species) = 'array');
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_deposit BOOLEAN DEFAULT FALSE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS deposit_rate NUMERIC(5, 2) DEFAULT 20;
    `);

    // Lịch sử nhận diện hoa: chỉ lưu kết quả, không lưu ảnh
    await client.query(`
      CREATE TABLE IF NOT EXISTS flower_identifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scientific_name VARCHAR(255) NOT NULL,
        vietnamese_name VARCHAR(255) NOT NULL DEFAULT '',
        common_names JSONB NOT NULL DEFAULT '[]'::jsonb,
        family VARCHAR(255) NOT NULL DEFAULT '',
        score NUMERIC(6, 5) NOT NULL CHECK (score >= 0 AND score <= 1),
        description JSONB NOT NULL DEFAULT '{}'::jsonb,
        candidates JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(candidates) = 'array'),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_flower_identifications_user_created
        ON flower_identifications(user_id, created_at DESC);
      -- Storage key of the uploaded photo (private, never served publicly); NULL if not stored
      ALTER TABLE flower_identifications ADD COLUMN IF NOT EXISTS image_key VARCHAR(255);
    `);

    // 9. Bảng đánh giá sản phẩm (reviews)
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        content TEXT,
        images JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
    `);

    // 10. Bảng upload file (uploads)
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        purpose VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Bảng giỏ hàng (carts & cart_items)
    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        variant_id VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
    `);

    // 12. Bảng đơn hàng (orders & order_items)
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        status_label VARCHAR(100) DEFAULT 'Chờ xác nhận',
        payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
        deposit_status VARCHAR(50) NOT NULL DEFAULT 'none',
        deposit_paid_at TIMESTAMP WITH TIME ZONE,
        payment_method VARCHAR(50) DEFAULT 'cod',
        payment_mode VARCHAR(50) DEFAULT 'full',
        delivery_method VARCHAR(50) DEFAULT 'standard',
        subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
        shipping_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
        deposit_rate NUMERIC(5, 2) DEFAULT 0,
        deposit_amount NUMERIC(15, 2) DEFAULT 0,
        amount_due_now NUMERIC(15, 2) DEFAULT 0,
        paid_amount NUMERIC(15, 2) DEFAULT 0,
        refunded_amount NUMERIC(15, 2) DEFAULT 0,
        held_amount NUMERIC(15, 2) DEFAULT 0,
        remaining_amount NUMERIC(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'VND',
        recipient JSONB DEFAULT '{}'::jsonb,
        shipment JSONB DEFAULT '{}'::jsonb,
        history JSONB DEFAULT '[]'::jsonb,
        note TEXT,
        coupon JSONB DEFAULT '{}'::jsonb,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        variant_id VARCHAR(100),
        product_name VARCHAR(255) NOT NULL,
        variant_label VARCHAR(255),
        color VARCHAR(100),
        image_url TEXT,
        unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        line_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    `);

    // 13. Bảng điều chỉnh kho (inventory_adjustments)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        variant_id VARCHAR(100),
        delta INTEGER NOT NULL,
        stock_before INTEGER NOT NULL,
        stock_after INTEGER NOT NULL,
        reason TEXT,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product_id ON inventory_adjustments(product_id);
    `);

    // 14. Bảng phiên thanh toán (payment_sessions) & xác nhận thu tiền / hoàn tiền
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        purpose VARCHAR(50) DEFAULT 'full',
        method VARCHAR(50) DEFAULT 'qr',
        provider VARCHAR(50) DEFAULT 'vietqr',
        status VARCHAR(50) DEFAULT 'pending',
        amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'VND',
        qr_payload TEXT,
        qr_image_url TEXT,
        payment_url TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        paid_at TIMESTAMP WITH TIME ZONE,
        failure_code VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payment_sessions_order_id ON payment_sessions(order_id);

      CREATE TABLE IF NOT EXISTS payment_confirmations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        kind VARCHAR(50) NOT NULL,
        amount NUMERIC(15, 2) NOT NULL,
        transaction_reference VARCHAR(100),
        status VARCHAR(50) DEFAULT 'confirmed',
        note TEXT,
        confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        amount NUMERIC(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        reason TEXT,
        transaction_reference VARCHAR(100),
        requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_requests (
        actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        operation VARCHAR(50) NOT NULL,
        request_key VARCHAR(200) NOT NULL,
        request_hash CHAR(64) NOT NULL,
        response JSONB NOT NULL,
        PRIMARY KEY (actor_id, operation, request_key)
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_confirmations_reference ON payment_confirmations(transaction_reference)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refunds_reference ON refunds(transaction_reference)');
    await client.query('COMMIT');
    console.log('✅ Hệ thống bảng (users, products, categories, orders, carts, payments, chat, shop, notifications) đã sẵn sàng.');

  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    const failures = error.errors?.length ? error.errors : [error];
    const details = failures.map((failure) =>
      [failure.code, failure.message, failure.address, failure.port].filter(Boolean).join(' ')
    ).join('; ');
    console.error('❌ Lỗi khởi tạo PostgreSQL:', details || error.name);
    if (failures.some((failure) => failure.code === '28P01')) {
      console.error('Kiểm tra DB_USER/DB_PASSWORD trong .env (hoặc DATABASE_URL nếu có).');
    } else if (failures.some((failure) => failure.code === 'ECONNREFUSED')) {
      console.error('Kiểm tra PostgreSQL đã chạy và DB_HOST/DB_PORT trong .env đúng chưa.');
    }
    throw error;
  } finally {
    client?.release();
  }
};

export default pool;
