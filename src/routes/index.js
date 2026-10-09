import { Router } from 'express';
import userRoutes from './user.routes.js';
import productRoutes from './product.routes.js';
import paymentRoutes from './payment.routes.js';
import chatRoutes from './chat.routes.js';
import shopRoutes from './shop.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

// Định tuyến API người dùng: /api/v1/users
router.use('/users', userRoutes);

// Định tuyến API sản phẩm: /api/v1/products
router.use('/products', productRoutes);

// Định tuyến API thanh toán: /api/v1/payments
router.use('/payments', paymentRoutes);

// Định tuyến API tin nhắn / chat: /api/v1/chat
router.use('/chat', chatRoutes);

// Định tuyến API thông tin cửa hàng: /api/v1/shop
router.use('/shop', shopRoutes);

// Định tuyến API thông báo: /api/v1/notifications
router.use('/notifications', notificationRoutes);

export default router;
