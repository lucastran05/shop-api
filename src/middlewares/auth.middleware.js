import { verifyAccessToken } from '../utils/jwt.js';

// Middleware xác thực JWT Access Token từ Header (Authorization: Bearer <accessToken>)
export const verifyAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Bạn chưa đăng nhập hoặc token không hợp lệ',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Token không được để trống',
      });
    }

    const decoded = verifyAccessToken(token);

    // Gán thông tin user đã giải mã vào req.user
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: error.message || 'Token không hợp lệ hoặc đã hết hạn',
    });
  }
};

// Middleware kiểm tra quyền hạn (Role-based access control)
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Bạn chưa đăng nhập',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Bạn không có quyền thực hiện hành động này',
      });
    }

    next();
  };
};

// Middleware kiểm tra xác thực tùy chọn (nếu có Bearer token hợp lệ thì gán req.user)
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
      }
    }
  } catch (error) {
    // optionalAuth bỏ qua lỗi token để cho phép request tiếp tục dạng khách (guest)
  }
  next();
};
