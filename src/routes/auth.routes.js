import { Router } from 'express';
import AuthController from '../controllers/auth.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = Router();

// AUTH01: Đăng ký tài khoản khách hàng
router.post('/register', authRateLimiter, AuthController.register);

// AUTH02: Đăng nhập
router.post('/login', authRateLimiter, AuthController.login);

// Refresh token
router.post('/refresh-token', authRateLimiter, AuthController.refreshToken);
router.post('/rf-token', authRateLimiter, AuthController.refreshToken);

// AUTH03: Đăng xuất
router.post('/logout', verifyAuth, AuthController.logout);

export default router;
