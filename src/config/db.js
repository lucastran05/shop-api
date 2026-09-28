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

    // Đảm bảo cột rf_token tồn tại nếu bảng đã có sẵn từ trước
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rf_token TEXT;`);

    console.log('✅ Bảng "users" với UUID và rf_token đã sẵn sàng.');

    client.release();
  } catch (error) {
    console.error('❌ Lỗi kết nối PostgreSQL:', error.message);
  }
};

export default pool;
