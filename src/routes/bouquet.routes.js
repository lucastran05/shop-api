import { Router } from 'express';
import CartController from '../controllers/cart.controller.js';

const router = Router();

// CART06: kiểu giấy gói và dáng bó (công khai, trang Tự tạo bó dùng khi chưa đăng nhập)
router.get('/options', CartController.getBouquetOptions);

export default router;
