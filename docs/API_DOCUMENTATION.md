# TÀI LIỆU ĐẶC TẢ KỸ THUẬT TOÀN DIỆN SHOP API (MASTER API SPECIFICATION)

> **Dự án:** Shop API - Hệ Thống Backend E-Commerce & Customer Support  
> **Phiên bản API:** v1 (`/api/v1`)  
> **Kiến trúc:** Node.js Express (ES Modules) & PostgreSQL  
> **Cơ chế xác thực:** JWT Dual-Token (Access Token 15m + Refresh Token Rotation 7d)  
> **Định danh khóa chính:** UUID v4 (`gen_random_uuid()`)  

---

## MỤC LỤC TỔNG QUAN

1. [Tổng Quan Kiến Trúc & Cơ Chế Bảo Mật](#1-tổng-quan-kiến-trúc--cơ-chế-bảo-mật)
2. [Ma Trận Phân Quyền Toàn Hệ Thống (RBAC Matrix)](#2-ma-trận-phân-quyền-toàn-hệ-thống-rbac-matrix)
3. [Quy Chuẩn Phản Hồi & Mã Lỗi HTTP](#3-quy-chuẩn-phản-hồi--mã-lỗi-http)
4. [Nhóm 1: Xác Thực & Quản Lý Phiên (Authentication API)](#4-nhóm-1-xác-thực--quản-lý-phiên-authentication-api)
5. [Nhóm 2: Quản Lý Người Dùng (Users Management API)](#5-nhóm-2-quản-lý-người-dùng-users-management-api)
6. [Nhóm 3: Quản Lý Sản Phẩm & Danh Mục (Products & Categories API)](#6-nhóm-3-quản-lý-sản-phẩm--danh-mục-products--categories-api)
7. [Nhóm 4: Giao Dịch & Thanh Toán (Payments & Transactions API)](#7-nhóm-4-giao-dịch--thanh-toán-payments--transactions-api)
8. [Nhóm 5: Tin Nhắn & Hỗ Trợ Khách Hàng (Chat & Support API)](#8-nhóm-5-tin-nhắn--hỗ-trợ-khách-hàng-chat--support-api)
9. [Nhóm 6: Cấu Hình Cửa Hàng (Shop Settings API)](#9-nhóm-6-cấu-hình-cửa-hàng-shop-settings-api)
10. [Nhóm 7: Thông Báo Hệ Thống (Notifications API)](#10-nhóm-7-thông-báo-hệ-thống-notifications-api)
11. [Ánh Xạ Bộ Sưu Tập Kiểm Thử Bruno HTTP Collection](#11-ánh-xạ-bộ-sưu-tập-kiểm-thử-bruno-http-collection)

---

## 1. TỔNG QUAN KIẾN TRÚC & CƠ CHẾ BẢO MẬT

### 1.1. Hệ Thống Dual Token & Refresh Token Rotation (RTR)
- **`accessToken`**:
  - Hạn dùng: 15 phút.
  - Mục đích: Đính kèm trong header `Authorization: Bearer <accessToken>`.
  - Claim: Chứa `id` (UUID), `email`, `role`, `token_type: 'access'`, và `jti` (UUID ngẫu nhiên chống replay).
- **`refreshToken`**:
  - Hạn dùng: 7 ngày.
  - Mục đích: Gửi lên endpoint `/users/refresh-token` để cấp mới token.
  - Không lưu plain-text: Database chỉ lưu chuỗi băm **SHA-256** của Refresh Token trong cột `rf_token`.
- **Phát hiện tái sử dụng (Reuse Detection):** Nếu Refresh Token cũ đã bị xoay vòng hoặc thu hồi bị gửi lại, hệ thống lập tức hủy phiên hiện tại (`rf_token = NULL`) và trả về `403 Forbidden`.
- **Chống Race Condition (RFC 6819 Concurrency Mitigation):** Xử lý đồng bộ hóa `in-flight promise deduplication` khi nhiều component đồng thời hết hạn access token.

### 1.2. Bảo Vệ Phiên & Chống Leo Thang Quyền Hạn
- **Đổi mật khẩu / Khóa tài khoản:** Tự động thu hồi Refresh Token (`rf_token = NULL`).
- **Chống leo thang đặc quyền:** Người dùng thường (`role: customer`) bị loại bỏ trường `role` và `active` khi cập nhật tài khoản.
- **Giới hạn tần suất (Rate Limiting):** Tối đa 10 request / 15 phút cho các endpoint `/register`, `/login`, `/refresh-token`.

---

## 2. MA TRẬN PHÂN QUYỀN TOÀN HỆ THỐNG (RBAC MATRIX)

| STT | Phương thức | Endpoint | Yêu cầu xác thực | Vai trò cho phép |
| :---: | :---: | :--- | :--- | :--- |
| 1 | `GET` | `/api/health` | Public | Mọi người |
| 2 | `POST` | `/api/v1/users/register` | Public (Rate Limited) | Mọi người |
| 3 | `POST` | `/api/v1/users/login` | Public (Rate Limited) | Mọi người |
| 4 | `POST` | `/api/v1/users/refresh-token` | Public (Rate Limited) | Mọi người |
| 5 | `GET` | `/api/v1/users/me` | Bearer Token | Bất kỳ user active |
| 6 | `POST` | `/api/v1/users/logout` | Bearer Token | Bất kỳ user |
| 7 | `GET` | `/api/v1/users` | Bearer Token | `admin`, `manager` |
| 8 | `POST` | `/api/v1/users` | Bearer Token | `admin` |
| 9 | `GET` | `/api/v1/users/:id` | Bearer Token | Chính chủ hoặc `admin`, `manager` |
| 10 | `PUT` | `/api/v1/users/:id` | Bearer Token | Chính chủ hoặc `admin` |
| 11 | `DELETE`| `/api/v1/users/:id` | Bearer Token | `admin` (trừ chính mình) |
| 12 | `GET` | `/api/v1/products/categories` | Public | Mọi người |
| 13 | `GET` | `/api/v1/products` | Public | Mọi người |
| 14 | `GET` | `/api/v1/products/:id` | Public | Mọi người |
| 15 | `POST` | `/api/v1/products` | Bearer Token | `admin`, `manager` |
| 16 | `PUT` | `/api/v1/products/:id` | Bearer Token | `admin`, `manager` |
| 17 | `DELETE`| `/api/v1/products/:id` | Bearer Token | `admin`, `manager` |
| 18 | `POST` | `/api/v1/products/bulk-delete` | Bearer Token | `admin`, `manager` |
| 19 | `GET` | `/api/v1/payments` | Bearer Token | Customer (xem mình), Staff (xem hết) |
| 20 | `GET` | `/api/v1/payments/:id` | Bearer Token | Chính chủ hoặc `admin`, `manager` |
| 21 | `GET` | `/api/v1/payments/order/:orderId` | Bearer Token | Chính chủ hoặc `admin`, `manager` |
| 22 | `POST` | `/api/v1/payments` | Bearer Token | Bất kỳ user |
| 23 | `PUT` | `/api/v1/payments/:id` | Bearer Token | `admin`, `manager` |
| 24 | `PATCH` | `/api/v1/payments/:id/status` | Bearer Token | `admin`, `manager` |
| 25 | `DELETE`| `/api/v1/payments/:id` | Bearer Token | `admin` |
| 26 | `GET` | `/api/v1/chat/conversations` | Bearer Token | `admin`, `manager` |
| 27 | `GET` | `/api/v1/chat/messages` | Bearer Token | Customer (xem mình), Staff (xem hết) |
| 28 | `GET` | `/api/v1/chat/messages/:id` | Bearer Token | Người gửi, chủ chat hoặc Staff |
| 29 | `POST` | `/api/v1/chat/messages` | Bearer Token | Bất kỳ user |
| 30 | `PATCH` | `/api/v1/chat/messages/:id/read` | Bearer Token | Người gửi, chủ chat hoặc Staff |
| 31 | `PATCH` | `/api/v1/chat/read-all` | Bearer Token | Bất kỳ user |
| 32 | `DELETE`| `/api/v1/chat/messages/:id` | Bearer Token | Người gửi hoặc Staff |
| 33 | `DELETE`| `/api/v1/chat/conversations/:owner`| Bearer Token | Chủ chat hoặc Staff |
| 34 | `GET` | `/api/v1/shop` | Public | Mọi người |
| 35 | `POST` | `/api/v1/shop` | Bearer Token | `admin` |
| 36 | `PUT` | `/api/v1/shop` | Bearer Token | `admin` |
| 37 | `POST` | `/api/v1/shop/reset` | Bearer Token | `admin` |
| 38 | `GET` | `/api/v1/notifications` | Bearer Token | Customer (nhận tin mình), Staff (xem hết) |
| 39 | `GET` | `/api/v1/notifications/:id` | Bearer Token | Người nhận hoặc Staff |
| 40 | `POST` | `/api/v1/notifications` | Bearer Token | `admin`, `manager` |
| 41 | `PATCH` | `/api/v1/notifications/:id/read` | Bearer Token | Người nhận hoặc Staff |
| 42 | `PATCH` | `/api/v1/notifications/mark-all-read`| Bearer Token| Bất kỳ user |
| 43 | `DELETE`| `/api/v1/notifications/:id` | Bearer Token | Người nhận hoặc Staff |
| 44 | `DELETE`| `/api/v1/notifications/clear-read` | Bearer Token | Bất kỳ user |

---

## 3. QUY CHUẨN PHẢN HỒI & MÃ LỖI HTTP

- **Khung phản hồi thành công:**
  ```json
  { "status": "success", "message": "Thông điệp (tùy chọn)", "data": { ... } }
  ```
- **Khung phản hồi thất bại:**
  ```json
  { "status": "error", "message": "Nguyên nhân lỗi chi tiết" }
  ```

---

## 4. NHÓM 1: XÁC THỰC & QUẢN LÝ PHIÊN (AUTHENTICATION API)

### 4.1. Đăng ký tài khoản (Register)
- **Method & Path:** `POST /api/v1/users/register`
- **Auth:** Public (Rate Limited 10 req / 15m)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "name": "Lucas Tran",
    "email": "lucas@example.com",
    "password": "Password123"
  }
  ```
- **Responses:**
  - `201 Created`:
    ```json
    {
      "status": "success",
      "message": "Đăng ký tài khoản thành công",
      "data": {
        "user": {
          "id": "e3a7b960-91a5-48b4-a698-32380598b981",
          "name": "Lucas Tran",
          "email": "lucas@example.com",
          "role": "customer",
          "createdAt": "2026-10-10T13:45:00.000Z"
        },
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
    ```
  - `400 Bad Request`: `Vui lòng cung cấp đầy đủ tên, email và mật khẩu` / `Email không đúng định dạng hợp lệ` / `Mật khẩu phải có ít nhất 6 ký tự` / `Email đã được sử dụng`.
  - `429 Too Many Requests`: `Quá nhiều yêu cầu xác thực từ IP của bạn, vui lòng thử lại sau 15 phút`.

### 4.2. Đăng nhập (Login)
- **Method & Path:** `POST /api/v1/users/login`
- **Auth:** Public (Rate Limited)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "lucas@example.com",
    "password": "Password123"
  }
  ```
- **Responses:**
  - `200 OK`: Trả về `user`, `accessToken`, `refreshToken`.
  - `400 Bad Request`: `Vui lòng nhập email và mật khẩu`.
  - `401 Unauthorized`: `Email hoặc mật khẩu không chính xác`.
  - `403 Forbidden`: `Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ quản trị viên.`

### 4.3. Làm mới Access Token (Refresh Token Rotation)
- **Method & Path:** `POST /api/v1/users/refresh-token` (hoặc `/rf-token`)
- **Auth:** Public (Rate Limited)
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Responses:**
  - `200 OK`: Trả về `accessToken` và `refreshToken` mới.
  - `400 Bad Request`: `Vui lòng cung cấp refreshToken hoặc rf_token`.
  - `403 Forbidden`: `Refresh Token không hợp lệ hoặc đã hết hạn` hoặc `Cảnh báo bảo mật: Refresh Token không hợp lệ hoặc đã được sử dụng trước đó (nguy cơ bị chiếm đoạt)...`.

### 4.4. Lấy hồ sơ tài khoản hiện tại (Get Me)
- **Method & Path:** `GET /api/v1/users/me`
- **Auth:** `Bearer Token` (`accessToken`)
- **Responses:**
  - `200 OK`: Trả về thông tin `user` hiện tại (id, name, email, role, phone, address, avatar, active, created_at).
  - `401 Unauthorized`: `Token xác thực không hợp lệ hoặc đã hết hạn`.
  - `403 Forbidden`: `Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa`.

### 4.5. Đăng xuất (Logout)
- **Method & Path:** `POST /api/v1/users/logout`
- **Auth:** `Bearer Token` (`accessToken`)
- **Responses:**
  - `200 OK`: `{ "status": "success", "message": "Đăng xuất thành công" }`.

---

## 5. NHÓM 2: QUẢN LÝ NGƯỜI DÙNG (USERS MANAGEMENT API)

### 5.1. Lấy danh sách người dùng (Get All Users)
- **Method & Path:** `GET /api/v1/users`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Query Params:** `page` (default 1), `limit` (default 20), `search`, `role`, `active`.
- **Responses:**
  - `200 OK`: `{ "status": "success", "data": { "users": [...], "total": 1, "page": 1, "limit": 20, "totalPages": 1 } }`.
  - `403 Forbidden`: `Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin, manager)`.

### 5.2. Lấy chi tiết người dùng theo ID (Get User By ID)
- **Method & Path:** `GET /api/v1/users/:id`
- **Auth:** `Bearer Token`, Chính chủ hoặc `admin`, `manager`
- **URL Params:** `id` (UUID v4)
- **Responses:**
  - `200 OK`: `{ "status": "success", "data": { "user": { ... } } }`.
  - `403 Forbidden`: `Bạn không có quyền xem thông tin của người dùng này`.
  - `404 Not Found`: `Không tìm thấy người dùng`.

### 5.3. Tạo người dùng qua quyền quản trị (Create User)
- **Method & Path:** `POST /api/v1/users`
- **Auth:** `Bearer Token`, Role: `admin`
- **Request Body:**
  ```json
  {
    "name": "Trần Văn Quản Lý",
    "email": "manager01@shop.vn",
    "password": "ManagerPass123",
    "role": "manager",
    "phone": "0912345678",
    "address": "456 Nguyễn Huệ, Quận 1, TP.HCM",
    "avatar": "https://example.com/avatar.jpg",
    "active": true
  }
  ```
- **Responses:**
  - `201 Created`: Tạo thành công.
  - `400 Bad Request`: `Vui lòng cung cấp tên và email` / `Email đã được sử dụng`.

### 5.4. Cập nhật người dùng (Update User)
- **Method & Path:** `PUT /api/v1/users/:id`
- **Auth:** `Bearer Token`, Chính chủ hoặc `admin`
- **Request Body:** `{ "name": "...", "phone": "...", "address": "...", "avatar": "...", "password": "...", "role": "admin", "active": true }`.
  *(Non-admin bị tước quyền sửa `role` và `active`).*
- **Responses:**
  - `200 OK`: Cập nhật thành công.
  - `403 Forbidden`: `Bạn không có quyền chỉnh sửa thông tin người dùng khác`.

### 5.5. Xóa người dùng (Delete User)
- **Method & Path:** `DELETE /api/v1/users/:id`
- **Auth:** `Bearer Token`, Role: `admin`
- **Responses:**
  - `200 OK`: Xóa thành công.
  - `400 Bad Request`: `Không thể xóa tài khoản của chính bạn đang sử dụng`.

---

## 6. NHÓM 3: QUẢN LÝ SẢN PHẨM & DANH MỤC (PRODUCTS & CATEGORIES API)

### 6.1. Lấy danh sách danh mục (Get Categories)
- **Method & Path:** `GET /api/v1/products/categories`
- **Auth:** Public
- **Responses:**
  - `200 OK`: `{ "status": "success", "data": { "categories": ["Bàn phím cơ", "Chuột", "Tai nghe"] } }`.

### 6.2. Lấy danh sách sản phẩm (Get All Products)
- **Method & Path:** `GET /api/v1/products`
- **Auth:** Public
- **Query Params:** `page`, `limit`, `search`, `category`, `featured`, `active`, `minPrice`, `maxPrice`, `sort` (`newest`, `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`).
- **Responses:**
  - `200 OK`: Trả về danh sách `products` kèm `total`, `page`, `limit`, `totalPages`.

### 6.3. Lấy chi tiết sản phẩm (Get Product By ID)
- **Method & Path:** `GET /api/v1/products/:id`
- **Auth:** Public
- **Responses:**
  - `200 OK`: Chi tiết `product`.
  - `404 Not Found`: `Không tìm thấy sản phẩm`.

### 6.4. Thêm mới sản phẩm (Create Product)
- **Method & Path:** `POST /api/v1/products`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Request Body:**
  ```json
  {
    "name": "Tai Nghe Chống Ồn Wireless Pro X",
    "category": "Âm thanh",
    "description": "Tai nghe over-ear chống ồn chủ động ANC",
    "price": 2500000,
    "oldPrice": 3200000,
    "stock": 50,
    "image": "https://example.com/headphone.jpg",
    "images": ["https://example.com/headphone.jpg"],
    "variants": [{"color": "Đen", "sku": "ANC-BLK"}],
    "attributes": [{"name": "Pin", "value": "40h"}],
    "featured": true,
    "active": true,
    "deposit": true,
    "depositRate": 25
  }
  ```
- **Responses:**
  - `201 Created`: Tạo thành công.
  - `400 Bad Request`: `Tên sản phẩm không được để trống` / `Danh mục không được để trống`.

### 6.5. Cập nhật sản phẩm (Update Product)
- **Method & Path:** `PUT /api/v1/products/:id`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Responses:**
  - `200 OK`: Cập nhật thành công.
  - `404 Not Found`: `Không tìm thấy sản phẩm để cập nhật`.

### 6.6. Xóa sản phẩm (Delete Product)
- **Method & Path:** `DELETE /api/v1/products/:id`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Responses:**
  - `200 OK`: Xóa thành công.

### 6.7. Xóa nhiều sản phẩm (Bulk Delete)
- **Method & Path:** `POST /api/v1/products/bulk-delete` (hoặc `DELETE /api/v1/products/bulk`)
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Request Body:** `{ "ids": ["uuid1", "uuid2"] }`
- **Responses:**
  - `200 OK`: `{ "status": "success", "message": "Đã xóa 2 sản phẩm thành công", "data": { "deletedCount": 2 } }`.

---

## 7. NHÓM 4: GIAO DỊCH & THANH TOÁN (PAYMENTS & TRANSACTIONS API)

### 7.1. Lấy danh sách thanh toán (Get All Payments)
- **Method & Path:** `GET /api/v1/payments`
- **Auth:** `Bearer Token` (Khách hàng chỉ xem lịch sử của mình; Nhân viên xem toàn bộ).
- **Query Params:** `page`, `limit`, `order_id`, `user_id` (Staff only), `status`, `payment_method`, `payment_type`.
- **Responses:**
  - `200 OK`: Trả về danh sách `payments`.

### 7.2. Lấy chi tiết thanh toán theo ID (Get Payment By ID)
- **Method & Path:** `GET /api/v1/payments/:id`
- **Auth:** `Bearer Token`, Chính chủ hoặc `admin`, `manager`
- **Responses:**
  - `200 OK`: Chi tiết giao dịch thanh toán.
  - `403 Forbidden`: `Bạn không có quyền xem thông tin giao dịch này`.

### 7.3. Lấy thanh toán theo mã đơn hàng (Get By Order ID)
- **Method & Path:** `GET /api/v1/payments/order/:orderId`
- **Auth:** `Bearer Token`, Chủ đơn hàng hoặc `admin`, `manager`
- **Responses:**
  - `200 OK`: Danh sách các đợt thanh toán của đơn hàng.

### 7.4. Tạo mới giao dịch thanh toán (Create Payment)
- **Method & Path:** `POST /api/v1/payments`
- **Auth:** `Bearer Token`
- **Request Body:**
  ```json
  {
    "order_id": "ORD-2026-001",
    "amount": 2500000,
    "payment_method": "bank",
    "payment_type": "full",
    "status": "pending",
    "transaction_id": "TXN_VN_20261010_001",
    "note": "Khách chuyển khoản Vietcombank",
    "metadata": { "bank_code": "VCB" }
  }
  ```
- **Responses:**
  - `201 Created`: Tạo thành công.
  - `400 Bad Request`: `Mã đơn hàng không được để trống` / `Số tiền thanh toán phải lớn hơn 0`.

### 7.5. Cập nhật thanh toán (Update Payment)
- **Method & Path:** `PUT /api/v1/payments/:id`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Responses:**
  - `200 OK`: Cập nhật thành công.

### 7.6. Cập nhật trạng thái thanh toán (Update Status)
- **Method & Path:** `PATCH /api/v1/payments/:id/status`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Request Body:** `{ "status": "completed" }`
- **Responses:**
  - `200 OK`: Cập nhật trạng thái thành công.

### 7.7. Xóa bản ghi thanh toán (Delete Payment)
- **Method & Path:** `DELETE /api/v1/payments/:id`
- **Auth:** `Bearer Token`, Role: `admin`
- **Responses:**
  - `200 OK`: Xóa thành công.

---

## 8. NHÓM 5: TIN NHẮN & HỖ TRỢ KHÁCH HÀNG (CHAT & SUPPORT API)

### 8.1. Lấy danh sách cuộc hội thoại (Get Conversations)
- **Method & Path:** `GET /api/v1/chat/conversations`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Responses:**
  - `200 OK`: Danh sách khách hàng chat, tin nhắn mới nhất và `unreadCount`.

### 8.2. Lấy danh sách tin nhắn (Get Messages)
- **Method & Path:** `GET /api/v1/chat/messages`
- **Auth:** `Bearer Token` (Khách hàng xem tin nhắn của mình; Nhân viên có thể lọc theo `owner`).
- **Query Params:** `owner`, `conversation_id`, `page`, `limit`, `unread_only`.
- **Responses:**
  - `200 OK`: Danh sách tin nhắn.

### 8.3. Lấy chi tiết một tin nhắn (Get Message By ID)
- **Method & Path:** `GET /api/v1/chat/messages/:id`
- **Auth:** `Bearer Token`, Người gửi, chủ chat hoặc Nhân viên.
- **Responses:**
  - `200 OK`: Chi tiết tin nhắn.

### 8.4. Gửi tin nhắn mới (Send Message)
- **Method & Path:** `POST /api/v1/chat/messages`
- **Auth:** `Bearer Token`
- **Request Body:**
  ```json
  {
    "message": "Shop còn sản phẩm này không ạ?",
    "conversation_id": "lucas@example.com"
  }
  ```
- **Responses:**
  - `201 Created`: Gửi tin nhắn thành công.

### 8.5. Đánh dấu một tin nhắn đã đọc (Mark As Read)
- **Method & Path:** `PATCH /api/v1/chat/messages/:id/read`
- **Auth:** `Bearer Token`
- **Responses:**
  - `200 OK`: `{ "status": "success", "message": "Đã đánh dấu tin nhắn là đã đọc" }`.

### 8.6. Đánh dấu tất cả tin nhắn đã đọc (Mark All As Read)
- **Method & Path:** `PATCH /api/v1/chat/read-all`
- **Auth:** `Bearer Token`
- **Responses:**
  - `200 OK`: Trả về `updatedCount`.

### 8.7. Xóa tin nhắn (Delete Message)
- **Method & Path:** `DELETE /api/v1/chat/messages/:id`
- **Auth:** `Bearer Token`, Người gửi hoặc Nhân viên.
- **Responses:**
  - `200 OK`: Xóa tin nhắn thành công.

### 8.8. Xóa cuộc hội thoại (Delete Conversation)
- **Method & Path:** `DELETE /api/v1/chat/conversations/:owner`
- **Auth:** `Bearer Token`, Chủ chat hoặc Nhân viên.
- **Responses:**
  - `200 OK`: Trả về `deletedCount`.

---

## 9. NHÓM 6: CẤU HÌNH CỬA HÀNG (SHOP SETTINGS API)

### 9.1. Lấy thông tin cửa hàng (Get Shop Info)
- **Method & Path:** `GET /api/v1/shop`
- **Auth:** Public
- **Responses:**
  - `200 OK`: Toàn bộ thông tin liên hệ, logo, banner, chính sách vận chuyển & cọc.

### 9.2. Cập nhật thông tin cửa hàng (Update Shop Info)
- **Method & Path:** `PUT /api/v1/shop` (hoặc `POST /api/v1/shop`)
- **Auth:** `Bearer Token`, Role: `admin`
- **Request Body:** Tên shop, hotline, địa chỉ, mapUrl, logoUrl, bannerUrl, socialLinks, commerce.
- **Responses:**
  - `200 OK`: Cập nhật thành công.
  - `400 Bad Request`: `Tên cửa hàng không được để trống`.

### 9.3. Khôi phục cài đặt mặc định (Reset Shop Info)
- **Method & Path:** `POST /api/v1/shop/reset` (hoặc `DELETE /api/v1/shop/reset`)
- **Auth:** `Bearer Token`, Role: `admin`
- **Responses:**
  - `200 OK`: Khôi phục thành công về dữ liệu gốc.

---

## 10. NHÓM 7: THÔNG BÁO HỆ THỐNG (NOTIFICATIONS API)

### 10.1. Lấy danh sách thông báo (Get All Notifications)
- **Method & Path:** `GET /api/v1/notifications`
- **Auth:** `Bearer Token`
- **Query Params:** `type`, `unread_only`, `page`, `limit`, `user_id`, `owner`.
- **Responses:**
  - `200 OK`: Danh sách thông báo kèm `unreadCount`.

### 10.2. Lấy chi tiết thông báo (Get Notification By ID)
- **Method & Path:** `GET /api/v1/notifications/:id`
- **Auth:** `Bearer Token`, Người nhận hoặc Nhân viên.
- **Responses:**
  - `200 OK`: Chi tiết thông báo.

### 10.3. Tạo thông báo mới (Create Notification)
- **Method & Path:** `POST /api/v1/notifications`
- **Auth:** `Bearer Token`, Role: `admin`, `manager`
- **Request Body:**
  ```json
  {
    "title": "Khuyến Mãi Cuối Tuần",
    "message": "Giảm ngay 20% cho phụ kiện máy tính!",
    "type": "promotion",
    "user_id": null,
    "key": "WEEKEND_PROMO"
  }
  ```
- **Responses:**
  - `201 Created`: Phát thông báo thành công.

### 10.4. Đánh dấu một thông báo đã đọc (Mark As Read)
- **Method & Path:** `PATCH /api/v1/notifications/:id/read`
- **Auth:** `Bearer Token`
- **Responses:**
  - `200 OK`: Đánh dấu thành công.

### 10.5. Đánh dấu tất cả thông báo đã đọc (Mark All As Read)
- **Method & Path:** `PATCH /api/v1/notifications/mark-all-read`
- **Auth:** `Bearer Token`
- **Responses:**
  - `200 OK`: Trả về `updatedCount`.

### 10.6. Xóa một thông báo (Delete Notification)
- **Method & Path:** `DELETE /api/v1/notifications/:id`
- **Auth:** `Bearer Token`, Người nhận hoặc Nhân viên.
- **Responses:**
  - `200 OK`: Xóa thành công.

### 10.7. Dọn sạch thông báo đã đọc (Clear Read Notifications)
- **Method & Path:** `DELETE /api/v1/notifications/clear-read`
- **Auth:** `Bearer Token`
- **Responses:**
  - `200 OK`: Trả về `deletedCount`.

---

## 11. ÁNH XẠ BỘ SƯU TẬP KIỂM THỬ BRUNO HTTP COLLECTION

| Thư mục Bruno | File request `.bru` | Endpoint tương ứng | Ghi chú Script / Test |
| :--- | :--- | :--- | :--- |
| **Gốc** | `Health Check.bru` | `GET /api/health` | Assert status 200 |
| **Auth** | `Register.bru` | `POST /api/v1/users/register` | Tự động lưu `token`, `refreshToken` |
| **Auth** | `Login.bru` | `POST /api/v1/users/login` | Tự động lưu `token`, `refreshToken` |
| **Auth** | `Refresh Token.bru` | `POST /api/v1/users/refresh-token`| Tự động cập nhật cặp token mới |
| **Auth** | `Get Me.bru` | `GET /api/v1/users/me` | Sử dụng `{{token}}` |
| **Auth** | `Logout.bru` | `POST /api/v1/users/logout` | Xóa `rf_token` DB |
| **Users** | `Get All Users.bru` | `GET /api/v1/users` | Phân trang, tìm kiếm |
| **Users** | `Get User By ID.bru` | `GET /api/v1/users/:id` | Xem chi tiết theo UUID |
| **Users** | `Create User.bru` | `POST /api/v1/users` | Admin tạo user có role |
| **Users** | `Update User.bru` | `PUT /api/v1/users/:id` | Cập nhật hồ sơ |
| **Users** | `Delete User.bru` | `DELETE /api/v1/users/:id` | Xóa tài khoản |
| **Products** | `Get Categories.bru` | `GET /api/v1/products/categories` | Lấy danh mục distinct |
| **Products** | `Get All Products.bru` | `GET /api/v1/products` | Bộ lọc & sắp xếp đa tiêu chí |
| **Products** | `Get Product By ID.bru`| `GET /api/v1/products/:id` | Xem chi tiết sản phẩm |
| **Products** | `Create Product.bru` | `POST /api/v1/products` | Thêm sản phẩm kèm biến thể |
| **Products** | `Update Product.bru` | `PUT /api/v1/products/:id` | Điều chỉnh giá, kho |
| **Products** | `Delete Product.bru` | `DELETE /api/v1/products/:id` | Xóa sản phẩm |
| **Products** | `Bulk Delete Products.bru`| `POST /api/v1/products/bulk-delete` | Xóa nhiều sản phẩm |
| **Payments** | `Get All Payments.bru` | `GET /api/v1/payments` | Lọc đơn hàng, trạng thái |
| **Payments** | `Get Payment By ID.bru`| `GET /api/v1/payments/:id` | Tra cứu chi tiết |
| **Payments** | `Get Payments By Order ID.bru`| `GET /api/v1/payments/order/:orderId`| Tra cứu theo đơn |
| **Payments** | `Create Payment.bru` | `POST /api/v1/payments` | Tạo thanh toán |
| **Payments** | `Update Payment.bru` | `PUT /api/v1/payments/:id` | Cập nhật giao dịch |
| **Payments** | `Update Payment Status.bru`| `PATCH /api/v1/payments/:id/status`| Đổi trạng thái (completed) |
| **Payments** | `Delete Payment.bru` | `DELETE /api/v1/payments/:id` | Xóa giao dịch |
| **Chat** | `Get Conversations.bru`| `GET /api/v1/chat/conversations` | Danh sách phòng chat |
| **Chat** | `Get Messages.bru` | `GET /api/v1/chat/messages` | Lịch sử trao đổi |
| **Chat** | `Get Message By ID.bru`| `GET /api/v1/chat/messages/:id` | Chi tiết một tin |
| **Chat** | `Send Message.bru` | `POST /api/v1/chat/messages` | Gửi tin nhắn mới |
| **Chat** | `Mark Message As Read.bru`| `PATCH /api/v1/chat/messages/:id/read`| Đánh dấu tin đã xem |
| **Chat** | `Mark All Messages As Read.bru`| `PATCH /api/v1/chat/read-all` | Đánh dấu tất cả đã xem |
| **Chat** | `Delete Message.bru` | `DELETE /api/v1/chat/messages/:id` | Xóa tin nhắn |
| **Chat** | `Delete Conversation.bru`| `DELETE /api/v1/chat/conversations/:owner`| Xóa toàn bộ hội thoại |
| **Shop** | `Get Shop Info.bru` | `GET /api/v1/shop` | Cấu hình website |
| **Shop** | `Update Shop Info.bru` | `PUT /api/v1/shop` | Cập nhật thông tin shop |
| **Shop** | `Create Shop Info.bru` | `POST /api/v1/shop` | Lưu cấu hình shop |
| **Shop** | `Reset Shop Info.bru` | `POST /api/v1/shop/reset` | Reset về mặc định |
| **Notifications**| `Get All Notifications.bru`| `GET /api/v1/notifications`| Lấy thông báo cá nhân/sàn |
| **Notifications**| `Get Notification By ID.bru`| `GET /api/v1/notifications/:id`| Chi tiết thông báo |
| **Notifications**| `Create Notification.bru`| `POST /api/v1/notifications` | Phát thông báo mới |
| **Notifications**| `Mark Notification As Read.bru`| `PATCH /api/v1/notifications/:id/read`| Đánh dấu đã đọc |
| **Notifications**| `Mark All Notifications As Read.bru`| `PATCH /api/v1/notifications/mark-all-read`| Đánh dấu tất cả đã đọc |
| **Notifications**| `Delete Notification.bru`| `DELETE /api/v1/notifications/:id` | Xóa một thông báo |
| **Notifications**| `Clear Read Notifications.bru`| `DELETE /api/v1/notifications/clear-read`| Dọn sạch thông báo đã đọc |
