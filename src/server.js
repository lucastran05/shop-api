import dotenv from 'dotenv';
import app from './app.js';
import pool, { initDB } from './config/db.js';
import { initializeStorage } from './services/upload-storage.js';
import { attachChatSocket } from './services/chat-socket.js';

// Load biến môi trường từ .env
dotenv.config();

const PORT = process.env.PORT || 5000;

// Khởi động server và khởi tạo database
const startServer = async () => {
  // Kết nối và kiểm tra DB
  await initDB();
  await initializeStorage();

  const server = app.listen(PORT, () => {
    console.log(`[INFO] Server is listening at: http://localhost:${PORT}`);
    console.log(`[INFO] Health check URL: http://localhost:${PORT}/api/health`);
    console.log(`[INFO] Users endpoints: http://localhost:${PORT}/api/v1/users`);
    console.log(`[INFO] Products endpoints: http://localhost:${PORT}/api/v1/products`);
    console.log(`[INFO] Payments endpoints: http://localhost:${PORT}/api/v1/payments`);
    console.log(`[INFO] Chat endpoints: http://localhost:${PORT}/api/v1/chat`);
    console.log(`[INFO] Shop endpoints: http://localhost:${PORT}/api/v1/shop`);
    console.log(`[INFO] Notifications endpoints: http://localhost:${PORT}/api/v1/notifications`);
  });

  const closeChatSocket = attachChatSocket(server);

  // Xử lý các lỗi bất thường (Unhandled Rejection)
  process.on('unhandledRejection', (err) => {
    console.error('[ERROR] Unhandled Rejection! Đang đóng server...');
    console.error(err);
    closeChatSocket();
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

startServer().catch(async (error) => {
  console.error('[ERROR] Không thể khởi động API hoặc storage:', error.message);
  await pool.end();
  process.exitCode = 1;
});
