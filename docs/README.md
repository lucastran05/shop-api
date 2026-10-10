# Shop API Documentation & Technical Specifications

Chào mừng bạn đến với tài liệu kỹ thuật hoàn chỉnh của hệ thống Backend **Shop API**. Toàn bộ mã nguồn được xây dựng trên nền tảng **Node.js (Express ES Modules)** kết hợp cơ sở dữ liệu **PostgreSQL**, quản lý định danh bằng **UUID (v4)**, cơ chế bảo mật xác thực kép **Access Token & Refresh Token (RTR)** cùng phân quyền vai trò người dùng chặt chẽ (**RBAC**).

---

## 1. Mục Lục Tài Liệu Chuyên Sâu

Hệ thống tài liệu được module hóa chi tiết theo từng nhóm nghiệp vụ:

1. [Tài liệu API Xác Thực & Bảo Mật (Auth API)](./auth-api.md)
   - Đăng ký, Đăng nhập, Làm mới Token (RTR & Token Reuse Detection), Hồ sơ cá nhân (`/me`), Đăng xuất (`/logout`).
   - Cơ chế băm SHA-256 lưu trữ Refresh Token, chống race condition đồng thời (RFC 6819 Concurrency Mitigation).
2. [Tài liệu API Quản Lý Người Dùng & Phân Quyền (Users API & RBAC)](./users-api.md)
   - Quản lý danh sách người dùng, xem chi tiết, tạo tài khoản quản trị, cập nhật hồ sơ, xóa tài khoản.
   - Cơ chế chống leo thang đặc quyền (Privilege Escalation Protection), tự động thu hồi phiên khi đổi mật khẩu/khóa tài khoản.
3. [Tài liệu API Sản Phẩm & Danh Mục (Products API)](./products-api.md)
   - Xem danh mục, danh sách sản phẩm (phân trang, lọc giá, tìm kiếm full-text, sắp xếp đa tiêu chí), chi tiết sản phẩm.
   - Quản lý thêm/sửa/xóa sản phẩm, xóa hàng loạt (Bulk Delete), cấu hình biến thể (variants) & thuộc tính (attributes).
4. [Tài liệu API Thanh Toán & Giao Dịch (Payments API)](./payments-api.md)
   - Tạo giao dịch thanh toán (gán chặt với user_id), tra cứu lịch sử cá nhân vs đối soát toàn hệ thống, tra cứu theo đơn hàng.
   - Cập nhật trạng thái giao dịch (`completed`, `failed`, `refunded`,...), lưu trữ metadata ngân hàng.
5. [Tài liệu API Tin Nhắn & Hỗ Trợ Trực Tuyến (Chat API)](./chat-api.md)
   - Quản lý hội thoại khách hàng, gửi nhận tin nhắn 2 chiều (Customer - Staff), đếm tin chưa đọc, xóa tin nhắn/hội thoại.
6. [Tài liệu API Cấu Hình Cửa Hàng (Shop Settings API)](./shop-api.md)
   - Lấy thông tin thương hiệu, hotline, địa chỉ, bản đồ, logo, banner, chính sách phí ship & đặt cọc.
   - Cập nhật và khôi phục cài đặt mặc định (Self-healing fallback).
7. [Tài liệu API Thông Báo Hệ Thống (Notifications API)](./notifications-api.md)
   - Hệ thống thông báo in-app: Thông báo cá nhân theo `user_id` / `owner` và thông báo phát sóng (Broadcast System Notifications).
   - Đánh dấu đã đọc, xóa từng thông báo hoặc dọn sạch thông báo đã đọc.
8. [Hướng Dẫn Kiểm Thử Với Bruno Collection (Bruno Guide)](./bruno-guide.md)
   - Hướng dẫn cấu hình môi trường `Local`, thiết lập biến `{{baseUrl}}` và `{{token}}`, thứ tự chạy test tự động.

---

## 2. Quy Chuẩn Giao Tiếp API (API Standards)

### 2.1. Cấu Trúc Địa Chỉ URL (Base URL)
- Môi trường phát triển nội bộ: `http://localhost:5000`
- Tiền tố API phiên bản 1: `http://localhost:5000/api/v1`
- Endpoint kiểm tra sức khỏe server: `GET http://localhost:5000/api/health`

### 2.2. Định Dạng Chuẩn Của Phản Hồi (Standard Response Wrapper)

#### Phản hồi thành công (`200 OK`, `201 Created`):
```json
{
  "status": "success",
  "message": "Thông điệp thành công (nếu có)",
  "data": { ... }
}
```

#### Phản hồi thất bại (`400`, `401`, `403`, `404`, `429`, `500`):
```json
{
  "status": "error",
  "message": "Mô tả nguyên nhân lỗi cụ thể"
}
```

### 2.3. Bảng Mã Lỗi HTTP Thực Tế Thường Gặp
| Mã HTTP | Tên chuẩn | Trường hợp kích hoạt thực tế trong mã nguồn |
| :--- | :--- | :--- |
| `200` | OK | Xử lý yêu cầu đọc/ghi dữ liệu thành công |
| `201` | Created | Đăng ký tài khoản, tạo sản phẩm, phát sinh thanh toán, gửi tin nhắn thành công |
| `400` | Bad Request | Thiếu trường bắt buộc, sai định dạng email, mật khẩu dưới 6 ký tự, giá âm |
| `401` | Unauthorized | Sai tài khoản/mật khẩu, thiếu Bearer token, token hết hạn hoặc sai chữ ký |
| `403` | Forbidden | Không đủ quyền hạn (Customer vào trang Admin), token reuse bị phát hiện, tài khoản bị khóa |
| `404` | Not Found | Đường dẫn không tồn tại (`/api/v1/unknown`), không tìm thấy user/sản phẩm/thanh toán theo ID |
| `429` | Too Many Requests | Gửi quá 10 request / 15 phút tại các endpoint nhạy cảm (`authRateLimiter`) |
| `500` | Internal Server Error | Lỗi kết nối cơ sở dữ liệu PostgreSQL hoặc lỗi ngoại lệ chưa bắt được |

---

## 3. Tổng Hợp Toàn Bộ Endpoint Trong Hệ Thống (Master Inventory)

| Nhóm | Phương thức | Đường dẫn API | Xác thực | Quyền hạn tối thiểu | Mô tả ngắn gọn |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/health` | Không | Public | Kiểm tra trạng thái hoạt động của server |
| **Auth** | `POST` | `/api/v1/users/register` | Không | Public (Rate Limited) | Đăng ký tài khoản mới (sinh UUID) |
| **Auth** | `POST` | `/api/v1/users/login` | Không | Public (Rate Limited) | Đăng nhập hệ thống, cấp cặp token |
| **Auth** | `POST` | `/api/v1/users/refresh-token` | Không | Public (Rate Limited) | Cấp mới token (RTR + Reuse Detection) |
| **Auth** | `GET` | `/api/v1/users/me` | Bearer Token | Bất kỳ user đang active | Lấy thông tin tài khoản hiện tại |
| **Auth** | `POST` | `/api/v1/users/logout` | Bearer Token | Bất kỳ user | Đăng xuất, hủy phiên trong database |
| **Users** | `GET` | `/api/v1/users` | Bearer Token | `admin`, `manager` | Xem danh sách người dùng toàn hệ thống |
| **Users** | `POST` | `/api/v1/users` | Bearer Token | `admin` | Admin tạo người dùng kèm phân vai trò |
| **Users** | `GET` | `/api/v1/users/:id` | Bearer Token | Chính chủ hoặc `admin`, `manager`| Xem chi tiết người dùng theo UUID |
| **Users** | `PUT` | `/api/v1/users/:id` | Bearer Token | Chính chủ hoặc `admin` | Cập nhật thông tin (chống đổi quyền) |
| **Users** | `DELETE`| `/api/v1/users/:id` | Bearer Token | `admin` (không tự xóa mình) | Xóa người dùng vĩnh viễn |
| **Products**| `GET` | `/api/v1/products/categories` | Không | Public | Lấy danh sách tên danh mục sản phẩm |
| **Products**| `GET` | `/api/v1/products` | Không | Public | Tìm kiếm, lọc và phân trang sản phẩm |
| **Products**| `GET` | `/api/v1/products/:id` | Không | Public | Xem chi tiết sản phẩm theo UUID |
| **Products**| `POST` | `/api/v1/products` | Bearer Token | `admin`, `manager` | Thêm sản phẩm mới vào kho |
| **Products**| `PUT` | `/api/v1/products/:id` | Bearer Token | `admin`, `manager` | Cập nhật thông tin, giá, tồn kho |
| **Products**| `DELETE`| `/api/v1/products/:id` | Bearer Token | `admin`, `manager` | Xóa một sản phẩm khỏi hệ thống |
| **Products**| `POST` | `/api/v1/products/bulk-delete` | Bearer Token | `admin`, `manager` | Xóa đồng thời nhiều sản phẩm theo mảng ID |
| **Payments**| `GET` | `/api/v1/payments` | Bearer Token | Customer (xem mình), Staff (tất cả) | Lấy danh sách lịch sử giao dịch |
| **Payments**| `GET` | `/api/v1/payments/:id` | Bearer Token | Chính chủ hoặc `admin`, `manager`| Xem chi tiết một giao dịch |
| **Payments**| `GET` | `/api/v1/payments/order/:orderId` | Bearer Token | Chính chủ hoặc `admin`, `manager`| Lấy toàn bộ thanh toán của đơn hàng |
| **Payments**| `POST` | `/api/v1/payments` | Bearer Token | Bất kỳ user | Tạo mới bản ghi thanh toán |
| **Payments**| `PUT` | `/api/v1/payments/:id` | Bearer Token | `admin`, `manager` | Chỉnh sửa chi tiết giao dịch |
| **Payments**| `PATCH` | `/api/v1/payments/:id/status` | Bearer Token | `admin`, `manager` | Cập nhật trạng thái thanh toán |
| **Payments**| `DELETE`| `/api/v1/payments/:id` | Bearer Token | `admin` | Xóa bản ghi thanh toán |
| **Chat** | `GET` | `/api/v1/chat/conversations` | Bearer Token | `admin`, `manager` | Quản lý xem toàn bộ các phòng hội thoại |
| **Chat** | `GET` | `/api/v1/chat/messages` | Bearer Token | Customer (xem mình), Staff (tất cả) | Xem lịch sử tin nhắn |
| **Chat** | `GET` | `/api/v1/chat/messages/:id` | Bearer Token | Người gửi, chủ chat hoặc Staff | Xem chi tiết một tin nhắn |
| **Chat** | `POST` | `/api/v1/chat/messages` | Bearer Token | Bất kỳ user | Gửi tin nhắn mới |
| **Chat** | `PATCH` | `/api/v1/chat/messages/:id/read` | Bearer Token | Người gửi, chủ chat hoặc Staff | Đánh dấu tin nhắn đã xem |
| **Chat** | `PATCH` | `/api/v1/chat/read-all` | Bearer Token | Bất kỳ user | Đánh dấu tất cả tin nhắn đã đọc |
| **Chat** | `DELETE`| `/api/v1/chat/messages/:id` | Bearer Token | Người gửi tin nhắn hoặc Staff | Xóa một tin nhắn |
| **Chat** | `DELETE`| `/api/v1/chat/conversations/:owner`| Bearer Token | Chủ hội thoại hoặc Staff | Xóa toàn bộ cuộc hội thoại |
| **Shop** | `GET` | `/api/v1/shop` | Không | Public | Lấy thông tin cấu hình cửa hàng |
| **Shop** | `POST` | `/api/v1/shop` | Bearer Token | `admin` | Tạo mới/ghi đè thông tin cửa hàng |
| **Shop** | `PUT` | `/api/v1/shop` | Bearer Token | `admin` | Cập nhật cấu hình cửa hàng |
| **Shop** | `POST` | `/api/v1/shop/reset` | Bearer Token | `admin` | Khôi phục cấu hình về mặc định |
| **Notify** | `GET` | `/api/v1/notifications` | Bearer Token | Customer (nhận tin mình), Staff (xem hết) | Lấy danh sách thông báo |
| **Notify** | `GET` | `/api/v1/notifications/:id` | Bearer Token | Người nhận hoặc Staff | Xem chi tiết thông báo |
| **Notify** | `POST` | `/api/v1/notifications` | Bearer Token | `admin`, `manager` | Phát thông báo cá nhân hoặc toàn sàn |
| **Notify** | `PATCH` | `/api/v1/notifications/:id/read` | Bearer Token | Người nhận hoặc Staff | Đánh dấu thông báo đã xem |
| **Notify** | `PATCH` | `/api/v1/notifications/mark-all-read`| Bearer Token| Bất kỳ user | Đánh dấu tất cả thông báo đã đọc |
| **Notify** | `DELETE`| `/api/v1/notifications/:id` | Bearer Token | Người nhận hoặc Staff | Xóa một thông báo |
| **Notify** | `DELETE`| `/api/v1/notifications/clear-read` | Bearer Token | Bất kỳ user | Dọn sạch tất cả thông báo đã xem |
