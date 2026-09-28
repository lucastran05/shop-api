import { Router } from 'express';
import AuthController from '../controllers/auth.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Đăng ký tài khoản mới (trả về id dạng UUID, accessToken, refreshToken)
router.post('/register', AuthController.register);

// Đăng nhập (trả về user, accessToken, refreshToken và lưu rf_token)
router.post('/login', AuthController.login);

// Làm mới Access Token bằng Refresh Token (hỗ trợ cả 2 đường dẫn)
router.post('/refresh-token', AuthController.refreshToken);
router.post('/rf-token', AuthController.refreshToken);

// Lấy thông tin cá nhân của người dùng hiện tại (cần Bearer token)
router.get('/me', verifyAuth, AuthController.getMe);

// Đăng xuất: xóa rf_token trong database
router.post('/logout', verifyAuth, AuthController.logout);

export default router;
