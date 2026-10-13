import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import locationRoutes from './location.routes.js';
import categoryRoutes from './category.routes.js';
import cartRoutes from './cart.routes.js';
import checkoutRoutes from './checkout.routes.js';
import orderRoutes from './order.routes.js';
import conversationRoutes from './conversation.routes.js';
import uploadRoutes from './upload.routes.js';

// Các module cũ (đảm bảo tương thích kiểm thử và đường dẫn hiện hữu)
import userRoutes from './user.routes.js';
import productRoutes from './product.routes.js';
import paymentRoutes from './payment.routes.js';
import chatRoutes from './chat.routes.js';
import shopRoutes from './shop.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

// --- 1. Theo đặc tả Danh sách API ABC Shop (/api/v1/...) ---

// AUTH01 - AUTH03: /api/v1/auth
router.use('/auth', authRoutes);

// AUTH04 - AUTH06, ADR01 - ADR05: /api/v1/me
router.use('/me', meRoutes);

// ADR06 - ADR07: /api/v1/locations
router.use('/locations', locationRoutes);

// CAT03: /api/v1/categories
router.use('/categories', categoryRoutes);

// CART01 - CART04: /api/v1/cart
router.use('/cart', cartRoutes);

// CHK01: /api/v1/checkout
router.use('/checkout', checkoutRoutes);

// ORD01 - ORD03, CHK02, PAY01: /api/v1/orders
router.use('/orders', orderRoutes);

// CHAT01 - CHAT03: /api/v1/conversations
router.use('/conversations', conversationRoutes);

// REV03 / ADP07: /api/v1/uploads
router.use('/uploads', uploadRoutes);

// --- 2. Các module hiện hữu (Đảm bảo 100% tương thích test suite) ---

// /api/v1/users
router.use('/users', userRoutes);

// /api/v1/products (CAT01, CAT02, REV01, REV02)
router.use('/products', productRoutes);

// /api/v1/payments (PAY02, SYS01, v.v.)
router.use('/payments', paymentRoutes);

// /api/v1/chat
router.use('/chat', chatRoutes);

// /api/v1/shop (SHOP01)
router.use('/shop', shopRoutes);

// /api/v1/notifications (NOT01, NOT02, NOT03)
router.use('/notifications', notificationRoutes);

export default router;
