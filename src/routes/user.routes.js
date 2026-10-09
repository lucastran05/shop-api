import { Router } from 'express';
import AuthController from '../controllers/auth.controller.js';
import UserController from '../controllers/user.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = Router();

// --- Auth Routes ---
// Đăng ký tài khoản mới (trả về id dạng UUID, accessToken, refreshToken)
router.post('/register', authRateLimiter, AuthController.register);

// Đăng nhập (trả về user, accessToken, refreshToken và lưu rf_token đã hash)
router.post('/login', authRateLimiter, AuthController.login);

// Làm mới Access Token bằng Refresh Token (hỗ trợ cả 2 đường dẫn)
router.post('/refresh-token', authRateLimiter, AuthController.refreshToken);
router.post('/rf-token', authRateLimiter, AuthController.refreshToken);

// Lấy thông tin cá nhân của người dùng hiện tại (yêu cầu Bearer Access Token)
router.get('/me', verifyAuth, AuthController.getMe);

// Đăng xuất: xóa rf_token trong database
router.post('/logout', verifyAuth, AuthController.logout);

// --- User Management Routes (Được bảo vệ nghiêm ngặt) ---
// Lấy danh sách người dùng (chỉ Admin và Manager mới có quyền xem)
router.get('/', verifyAuth, requireRole('admin', 'manager'), UserController.getAll);

// Tạo người dùng mới qua quyền quản trị (chỉ Admin)
router.post('/', verifyAuth, requireRole('admin'), UserController.create);

// Lấy thông tin chi tiết người dùng theo ID (chỉ chủ tài khoản hoặc Admin/Manager)
router.get('/:id', verifyAuth, UserController.getById);

// Cập nhật người dùng theo ID (chủ tài khoản hoặc Admin; không cho phép user thường đổi vai trò)
router.put('/:id', verifyAuth, UserController.update);

// Xóa người dùng theo ID (chỉ Admin)
router.delete('/:id', verifyAuth, requireRole('admin'), UserController.delete);

export default router;
