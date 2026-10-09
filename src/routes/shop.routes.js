import { Router } from 'express';
import ShopController from '../controllers/shop.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Lấy thông tin cấu hình cửa hàng (Công khai cho toàn bộ người dùng)
router.get('/', ShopController.get);

// Các thao tác thay đổi cấu hình cửa hàng yêu cầu quyền Admin tối cao
// Tạo mới hoặc ghi đè thông tin cửa hàng
router.post('/', verifyAuth, requireRole('admin'), ShopController.create);

// Cập nhật thông tin cửa hàng
router.put('/', verifyAuth, requireRole('admin'), ShopController.update);

// Khôi phục cài đặt cửa hàng về mặc định
router.post('/reset', verifyAuth, requireRole('admin'), ShopController.reset);
router.delete('/reset', verifyAuth, requireRole('admin'), ShopController.reset);

export default router;
