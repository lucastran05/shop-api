import { Router } from 'express';
import ProductController from '../controllers/product.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// --- Public Endpoints (Khách hàng có thể xem không cần đăng nhập) ---
// Lấy danh sách tất cả danh mục sản phẩm (phải đặt trước /:id)
router.get('/categories', ProductController.getCategories);

// Lấy danh sách sản phẩm (có phân trang, tìm kiếm, lọc theo giá, danh mục, trạng thái)
router.get('/', ProductController.getAll);

// Lấy thông tin chi tiết một sản phẩm
router.get('/:id', ProductController.getById);

// --- Protected Endpoints (Chỉ Quản trị viên và Quản lý mới có quyền chỉnh sửa kho hàng) ---
// Xóa nhiều sản phẩm theo danh sách ID
router.post('/bulk-delete', verifyAuth, requireRole('admin', 'manager'), ProductController.bulkDelete);
router.delete('/bulk', verifyAuth, requireRole('admin', 'manager'), ProductController.bulkDelete);

// Thêm mới sản phẩm
router.post('/', verifyAuth, requireRole('admin', 'manager'), ProductController.create);

// Cập nhật thông tin sản phẩm
router.put('/:id', verifyAuth, requireRole('admin', 'manager'), ProductController.update);

// Xóa sản phẩm
router.delete('/:id', verifyAuth, requireRole('admin', 'manager'), ProductController.delete);

export default router;
