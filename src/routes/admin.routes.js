import { Router } from 'express';
import ProductController from '../controllers/product.controller.js';
import CategoryController from '../controllers/category.controller.js';
import InventoryController from '../controllers/inventory.controller.js';
import OrderController from '../controllers/order.controller.js';
import PaymentController from '../controllers/payment.controller.js';
import ChatController from '../controllers/chat.controller.js';
import DashboardController from '../controllers/dashboard.controller.js';
import UserController from '../controllers/user.controller.js';
import ShopController from '../controllers/shop.controller.js';
import VoucherController from '../controllers/voucher.controller.js';
import { verifyAuth, requireRole } from '../middlewares/auth.middleware.js';
import { imageUpload } from '../middlewares/upload.middleware.js';

const router = Router();

// Tất cả các route quản trị đều yêu cầu xác thực và vai trò tối thiểu là manager hoặc admin
router.use(verifyAuth);
router.use(requireRole('admin', 'manager'));

// VOUCHERS: quản lý mã giảm giá
router.get('/vouchers', VoucherController.list);
router.post('/vouchers', VoucherController.create);
router.patch('/vouchers/:voucher_id', VoucherController.update);
router.put('/vouchers/:voucher_id', VoucherController.update);
router.post('/vouchers/bulk-delete', VoucherController.bulkDelete);
router.delete('/vouchers/:voucher_id', VoucherController.delete);

// ==========================================
// 1. DSH01 & REP01: TỔNG QUAN VÀ BÁO CÁO
// ==========================================
// DSH01: Số liệu tổng quan Dashboard
router.get('/dashboard', DashboardController.getDashboard);

// REP01: Báo cáo bán hàng theo kỳ (JSON hoặc CSV)
router.get('/reports/sales', DashboardController.getSalesReport);

// ==========================================
// 2. ADP01 - ADP07: QUẢN LÝ SẢN PHẨM
// ==========================================
// ADP06: Xóa nhiều sản phẩm (đặt trước /:product_id)
router.post('/products/bulk-delete', ProductController.bulkDelete);

// ADP01: Danh sách sản phẩm quản trị
router.get('/products', ProductController.adminGetAll);

// ADP02: Chi tiết sản phẩm quản trị
router.get('/products/:product_id', ProductController.adminGetById);

// ADP03: Thêm sản phẩm mới
router.post('/products', ProductController.create);

// ADP04: Lưu chỉnh sửa, ghim hoặc đổi trạng thái sản phẩm
router.patch('/products/:product_id', ProductController.update);
router.put('/products/:product_id', ProductController.update);

// ADP05: Xóa một sản phẩm
router.delete('/products/:product_id', ProductController.delete);

// ADP07: Tải ảnh sản phẩm
router.post('/uploads', imageUpload.array('files', 3), ProductController.upload);

// ==========================================
// 3. ADC01 - ADC05: QUẢN LÝ DANH MỤC
// ==========================================
// ADC05: Xóa nhiều danh mục (đặt trước /:category_id)
router.post('/categories/bulk-delete', CategoryController.bulkDelete);

// ADC01: Danh sách danh mục
router.get('/categories', CategoryController.getAll);

// ADC02: Thêm danh mục mới
router.post('/categories', CategoryController.create);

// ADC03: Đổi tên danh mục
router.patch('/categories/:category_id', CategoryController.update);
router.put('/categories/:category_id', CategoryController.update);

// ADC04: Xóa danh mục
router.delete('/categories/:category_id', CategoryController.delete);

// ==========================================
// 4. INV01 - INV03: QUẢN LÝ TỒN KHO
// ==========================================
// INV03: Lịch sử điều chỉnh tồn kho (đặt trước /:id)
router.get('/inventory/adjustments', InventoryController.getAdjustments);

// INV02: Điều chỉnh tồn kho thủ công
router.post('/inventory/adjustments', InventoryController.adjust);

// INV01: Bảng tồn kho theo biến thể
router.get('/inventory', InventoryController.getInventory);

// ==========================================
// 5. ADO01 - ADO03, ADY01 - ADY02: ĐƠN HÀNG VÀ THANH TOÁN
// ==========================================
// ADY01: Ghi nhận thanh toán thủ công (cọc hoặc đủ)
router.post('/orders/:order_id/payment-confirmations', PaymentController.confirmPayment);

// ADY02: Ghi nhận hoàn tiền
router.post('/orders/:order_id/refunds', PaymentController.refund);

// ADO03: Cập nhật trạng thái đơn, vận đơn, ghi chú
router.post('/orders/bulk-delete', OrderController.bulkDeleteAdminOrders);
router.patch('/orders/:order_id', OrderController.updateAdminOrder);

// ADO02: Chi tiết đơn hàng quản trị
router.get('/orders/:order_id', OrderController.getAdminOrderDetail);

// ADO01: Danh sách đơn hàng quản trị
router.get('/orders', OrderController.getAdminOrders);

// ==========================================
// 6. ADM01 - ADM03: TIN NHẮN VÀ HỘI THOẠI
// ==========================================
// ADM03: Tạo hội thoại mới và gửi tin nhắn đầu tiên cho khách hàng
router.post('/conversations', ChatController.createAdminConversation);
// ADM02: Quản trị nạp tin nhắn hội thoại
router.get('/conversations/:conversation_id/messages', ChatController.getAdminConversationMessages);

// ADM03: Shop gửi phản hồi trong hội thoại
router.post('/conversations/:conversation_id/messages', ChatController.sendAdminMessage);

// ADM01: Quản trị lấy danh sách hội thoại
router.get('/conversations', ChatController.getAdminConversations);

// ==========================================
// 7. SET01 - SET02: CÀI ĐẶT THÔNG TIN SHOP
// ==========================================
// SET01: Xem thông tin shop
router.get('/settings/shop', ShopController.getAdminSettings);

// SET02: Cập nhật thông tin shop
router.patch('/settings/shop', ShopController.update);
router.put('/settings/shop', ShopController.update);

// ==========================================
// 8. USR01 - USR05: QUẢN LÝ TÀI KHOẢN (CHỈ ADMIN TỐI CAO)
// ==========================================
// USR05: Xóa nhiều tài khoản (đặt trước /:user_id)
router.post('/users/bulk-delete', requireRole('admin'), UserController.adminBulkDelete);

// USR01: Danh sách tài khoản
router.get('/users', requireRole('admin'), UserController.adminGetUsers);

// USR02: Thêm tài khoản mới
router.post('/users', requireRole('admin'), UserController.adminCreateUser);

// USR03: Sửa tài khoản (đổi vai trò, khóa/mở)
router.patch('/users/:user_id', requireRole('admin'), UserController.adminUpdateUser);
router.put('/users/:user_id', requireRole('admin'), UserController.adminUpdateUser);

// USR04: Xóa tài khoản
router.delete('/users/:user_id', requireRole('admin'), UserController.adminDeleteUser);

export default router;
