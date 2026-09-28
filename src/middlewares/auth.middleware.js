import { verifyToken } from '../utils/jwt.js';

// Middleware xác thực JWT token từ Header
export const verifyAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Bạn chưa đăng nhập hoặc token không hợp lệ (cần Bearer token)',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Gán thông tin user đã giải mã vào req.user để các controller tiếp theo sử dụng
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Token không hợp lệ hoặc đã hết hạn',
    });
  }
};
