import { Router } from 'express';
import AuthController from '../controllers/auth.controller.js';
import AddressController from '../controllers/address.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Yêu cầu xác thực tài khoản
router.use(verifyAuth);

// AUTH04: Lấy hồ sơ người dùng
router.get('/', AuthController.getMe);

// AUTH05: Sửa tên và số điện thoại
router.patch('/', AuthController.updateMe);

// AUTH06: Đổi mật khẩu
router.put('/password', AuthController.updatePassword);

// ADR01: Danh sách địa chỉ nhận hàng
router.get('/addresses', AddressController.getAddresses);

// ADR02: Thêm địa chỉ mới
router.post('/addresses', AddressController.createAddress);

// ADR05: Đặt làm địa chỉ mặc định (đặt trước /:address_id để tránh match)
router.patch('/addresses/:address_id/default', AddressController.setDefaultAddress);

// ADR03: Sửa địa chỉ
router.patch('/addresses/:address_id', AddressController.updateAddress);

// ADR04: Xóa địa chỉ
router.delete('/addresses/:address_id', AddressController.deleteAddress);

export default router;
