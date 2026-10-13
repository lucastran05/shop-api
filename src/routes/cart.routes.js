import { Router } from 'express';
import CartController from '../controllers/cart.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Toàn bộ thao tác giỏ hàng yêu cầu xác thực
router.use(verifyAuth);

// CART01: Xem giỏ hàng
router.get('/', CartController.getCart);

// CART02: Thêm vào giỏ
router.post('/items', CartController.addItem);

// CART03: Cập nhật số lượng
router.patch('/items/:item_id', CartController.updateItem);

// CART04: Xóa sản phẩm khỏi giỏ
router.delete('/items/:item_id', CartController.removeItem);

export default router;
