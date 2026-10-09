# Tài Liệu API Người Dùng và Cơ Chế Bảo Mật (Users API & Security Mechanism)

Tài liệu chi tiết về API xác thực, phân quyền và cơ chế bảo mật cho ứng dụng Shop API, sử dụng **UUID (v4)** làm khóa chính, **Access Token & Refresh Token** qua JWT với thuật toán SHA-256 hash và cơ sở dữ liệu **PostgreSQL**.

---

## 1. Tổng Quan Cơ Chế Bảo Mật

### 1.1. Phân Tách Rõ Ràng Access Token & Refresh Token (Token Separation)
- `accessToken`:
  - **Thời hạn:** 15 phút (`JWT_ACCESS_EXPIRES_IN=15m`).
  - **Mục đích:** Truy cập các endpoint yêu cầu xác thực (`Authorization: Bearer <accessToken>`).
  - **Claim bảo mật:** Chứa `token_type: 'access'`, `id`, `email`, `role`, và `jti` (UUID ngẫu nhiên chống replay).
  - Không thể dùng `accessToken` làm `refreshToken` ở endpoint cấp mới token.
- `refreshToken`:
  - **Thời hạn:** 7 ngày (`JWT_REFRESH_EXPIRES_IN=7d`).
  - **Mục đích:** Gửi lên endpoint `/users/refresh-token` (hoặc `/rf-token`) để lấy `accessToken` mới.
  - **Claim bảo mật:** Chứa `token_type: 'refresh'`, `id`, và `jti`.
  - Không thể dùng `refreshToken` làm `accessToken` ở các endpoint bảo vệ nghiệp vụ (`/me`, `/products`, `/payments`,...).

### 1.2. Băm Mật Mã Refresh Token Trong Database (SHA-256 Hash Storage)
- Refresh Token tuyệt đối **không lưu dạng văn bản thô (plain-text)** trong database.
- Cột `rf_token` trong bảng `users` lưu chuỗi băm **SHA-256** của Refresh Token.
- Khi rò rỉ dữ liệu hoặc backup SQL bị lộ, kẻ tấn công không thể sử dụng dữ liệu trong bảng để mạo danh hay cấp mới `accessToken`.
- Hệ thống hỗ trợ backward compatibility tự động với dữ liệu cũ.

### 1.3. Refresh Token Rotation (RTR), Chống Race Condition & Phát Hiện Tái Sử Dụng Token
- Mỗi lần gọi `/users/refresh-token`, hệ thống sinh ra một cặp `accessToken` MỚI và `refreshToken` MỚI.
- Token cũ ngay lập tức bị vô hiệu hóa trong database.
- **Xử lý Race Condition khi nhiều request đồng thời (RFC 6819 Concurrency Mitigation):** Khi ứng dụng web (SPA/Mobile) gửi nhiều request đồng thời (ví dụ nhiều components cùng hết hạn access token và gọi refresh token cùng lúc), hệ thống tự động đồng bộ hóa tác vụ đang chạy (`in-flight promise deduplication`), chia sẻ cặp token mới đồng nhất cho các request đồng thời thay vì coi nhầm request đến sau là token reuse attack.
- **Phát hiện tái sử dụng (Reuse Detection):** Nếu một Refresh Token cũ đã bị xoay vòng hoặc thu hồi nhưng lại được gửi lên tuần tự sau đó (dấu hiệu token bị đánh cắp và kẻ tấn công cố dùng lại), hệ thống sẽ:
  1. Hủy ngay lập tức phiên đăng nhập hiện tại của người dùng (`rf_token = NULL`).
  2. Trả về mã lỗi `403 Forbidden` kèm cảnh báo bảo mật, buộc đăng nhập lại từ đầu.

### 1.4. Thu Hồi Phiên Khi Đổi Mật Khẩu & Kiểm Tra Trạng Thái Tài Khoản
- **Đổi mật khẩu / Khóa tài khoản:** Khi người dùng đổi mật khẩu hoặc quản trị viên cập nhật trạng thái `active = false`, toàn bộ `rf_token` trong DB sẽ bị hủy ngay lập tức (`rf_token = NULL`), buộc mọi thiết bị/phiên cũ phải đăng nhập lại với thông tin mới.
- **Khóa tài khoản (`active = false`):**
  - Chặn đăng nhập tại `/users/login` (HTTP 403).
  - Chặn làm mới token tại `/users/refresh-token` và thu hồi `rf_token` (HTTP 403).
  - Chặn lấy thông tin tại `/users/me` (HTTP 403).

### 1.5. Chống Leo Thang Đặc Quyền (Privilege Escalation Protection)
- Người dùng thông thường không có quyền tự đổi vai trò (`role`) hoặc trạng thái (`active`) của mình tại `PUT /users/:id`.
- Danh sách các cột cập nhật trong `UserModel` được bảo vệ bằng Allowlist chống SQL injection vào tên cột.

### 1.6. Giới Hạn Tần Suất Gửi Yêu Cầu (Rate Limiting)
- Các endpoint nhạy cảm (`/register`, `/login`, `/refresh-token`) được bảo vệ bằng Rate Limiter để chống Brute Force và từ chối dịch vụ (DDoS).

---

## 2. Cấu Trúc Bảng Dữ Liệu `users` (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'customer',
  rf_token TEXT,
  phone VARCHAR(25),
  address TEXT,
  avatar TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | Khóa chính ngẫu nhiên duy nhất (UUID v4) |
| `name` | `VARCHAR(100)` | NOT NULL | Tên người dùng |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Email dùng để đăng nhập |
| `password` | `VARCHAR(255)` | NOT NULL | Mật khẩu băm (bcrypt hash) |
| `role` | `VARCHAR(50)` | DEFAULT 'customer' | Vai trò (`customer`, `admin`, `manager`) |
| `rf_token` | `TEXT` | NULL | SHA-256 hash của Refresh Token mới nhất |
| `active` | `BOOLEAN` | DEFAULT TRUE | Trạng thái hoạt động của tài khoản |
| `created_at`| `TIMESTAMP WITH TIME ZONE` | DEFAULT CURRENT_TIMESTAMP | Ngày tạo |
| `updated_at`| `TIMESTAMP WITH TIME ZONE` | DEFAULT CURRENT_TIMESTAMP | Ngày cập nhật |

---

## 3. Ma Trận Phân Quyền API Toàn Hệ Thống (RBAC)

| Endpoint | Phương thức | Quyền truy cập | Mô tả bảo vệ |
| :--- | :--- | :--- | :--- |
| `/api/v1/users/register` | `POST` | Public (Rate Limited) | Đăng ký tài khoản (validate email, password) |
| `/api/v1/users/login` | `POST` | Public (Rate Limited) | Đăng nhập, kiểm tra `active`, cấp cặp token |
| `/api/v1/users/refresh-token` | `POST` | Public (Rate Limited) | Cấp mới token (RTR + Reuse Detection) |
| `/api/v1/users/me` | `GET` | Bearer Token | Lấy thông tin cá nhân hiện tại |
| `/api/v1/users/logout` | `POST` | Bearer Token | Đăng xuất, xóa `rf_token` |
| `/api/v1/users` | `GET` | Admin, Manager | Xem danh sách người dùng toàn hệ thống |
| `/api/v1/users` | `POST` | Admin | Quản trị viên tạo người dùng với role tùy chọn |
| `/api/v1/users/:id` | `GET` | Chính chủ hoặc Admin/Manager | Xem chi tiết người dùng |
| `/api/v1/users/:id` | `PUT` | Chính chủ hoặc Admin | Sửa thông tin (chặn leo thang quyền với user thường) |
| `/api/v1/users/:id` | `DELETE`| Admin | Xóa tài khoản (không cho tự xóa chính mình) |
| `/api/v1/products` | `GET` | Public | Xem danh sách sản phẩm |
| `/api/v1/products/categories` | `GET` | Public | Xem danh mục sản phẩm |
| `/api/v1/products/:id` | `GET` | Public | Xem chi tiết sản phẩm |
| `/api/v1/products` | `POST` | Admin, Manager | Thêm sản phẩm mới vào kho |
| `/api/v1/products/:id` | `PUT` | Admin, Manager | Chỉnh sửa sản phẩm |
| `/api/v1/products/:id` | `DELETE`| Admin, Manager | Xóa sản phẩm |
| `/api/v1/products/bulk-delete` | `POST` | Admin, Manager | Xóa nhiều sản phẩm |
| `/api/v1/payments` | `GET` | Bearer Token | User xem lịch sử của mình; Admin xem toàn bộ |
| `/api/v1/payments/:id` | `GET` | Chính chủ hoặc Admin | Xem chi tiết giao dịch thanh toán |
| `/api/v1/payments` | `POST` | Bearer Token | Tạo thanh toán (gán chặt với `user_id` người gửi) |
| `/api/v1/payments/:id/status` | `PATCH` | Admin, Manager | Cập nhật trạng thái giao dịch (completed,...) |
| `/api/v1/payments/:id` | `DELETE`| Admin | Xóa bản ghi thanh toán |
| `/api/v1/shop` | `GET` | Public | Xem thông tin cấu hình cửa hàng |
| `/api/v1/shop` | `POST`, `PUT` | Admin | Cập nhật cấu hình cửa hàng |
| `/api/v1/shop/reset` | `POST`, `DELETE`| Admin | Khôi phục cấu hình cửa hàng về mặc định |
| `/api/v1/chat/conversations` | `GET` | Admin, Manager | Quản lý xem toàn bộ các cuộc hội thoại |
| `/api/v1/chat/messages` | `GET`, `POST` | Bearer Token | Khách hàng chỉ trao đổi trong hội thoại của mình |
| `/api/v1/notifications` | `GET` | Bearer Token | Nhận thông báo của chính mình |
| `/api/v1/notifications` | `POST` | Admin, Manager | Phát thông báo hệ thống |

---

## 4. Chi Tiết Các Endpoint Xác Thực

### 4.1. Đăng ký tài khoản (`POST /users/register`)
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "name": "Lucas Tran",
    "email": "lucas@example.com",
    "password": "Password123"
  }
  ```
- **Response Thành công (`201 Created`):**
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
        "createdAt": "2026-09-28T07:35:00.000Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### 4.2. Đăng nhập (`POST /users/login`)
- **Body:**
  ```json
  {
    "email": "lucas@example.com",
    "password": "Password123"
  }
  ```
- **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "message": "Đăng nhập thành công",
    "data": {
      "user": {
        "id": "e3a7b960-91a5-48b4-a698-32380598b981",
        "name": "Lucas Tran",
        "email": "lucas@example.com",
        "role": "customer",
        "createdAt": "2026-09-28T07:35:00.000Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### 4.3. Cấp mới Access Token (`POST /users/refresh-token` hoặc `/users/rf-token`)
- **Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "message": "Làm mới token thành công",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Response Phát hiện Tái sử dụng Token (`403 Forbidden`):**
  ```json
  {
    "status": "error",
    "message": "Cảnh báo bảo mật: Refresh Token không hợp lệ hoặc đã được sử dụng trước đó (nguy cơ bị chiếm đoạt). Toàn bộ phiên làm việc đã bị hủy, vui lòng đăng nhập lại."
  }
  ```

### 4.4. Lấy thông tin cá nhân (`GET /users/me`)
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "e3a7b960-91a5-48b4-a698-32380598b981",
        "name": "Lucas Tran",
        "email": "lucas@example.com",
        "role": "customer",
        "phone": null,
        "address": null,
        "avatar": null,
        "active": true,
        "created_at": "2026-09-28T07:35:00.000Z",
        "updated_at": "2026-09-28T07:35:00.000Z"
      }
    }
  }
  ```

### 4.5. Đăng xuất (`POST /users/logout`)
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "message": "Đăng xuất thành công"
  }
  ```
