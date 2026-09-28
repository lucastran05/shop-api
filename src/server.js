import dotenv from 'dotenv';
import app from './app.js';
import { initDB } from './config/db.js';

// Load biến môi trường từ .env
dotenv.config();

const PORT = process.env.PORT || 5000;

// Khởi động server và khởi tạo database
const startServer = async () => {
  // Kết nối và kiểm tra DB
  await initDB();

  const server = app.listen(PORT, () => {
    console.log(`[INFO] Server is listening at: http://localhost:${PORT}`);
    console.log(`[INFO] Health check URL: http://localhost:${PORT}/api/health`);
    console.log(`[INFO] Users endpoints: http://localhost:${PORT}/api/v1/users`);
  });

  // Xử lý các lỗi bất thường (Unhandled Rejection)
  process.on('unhandledRejection', (err) => {
    console.error('[ERROR] Unhandled Rejection! Đang đóng server...');
    console.error(err);
    server.close(() => {
      process.exit(1);
    });
  });

  process.on('uncaughtException', (err) => {
    console.error('[ERROR] Uncaught Exception! Đang tắt tiến trình...');
    console.error(err);
    process.exit(1);
  });
};

startServer();
