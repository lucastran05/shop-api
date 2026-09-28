# Tài Liệu API Người Dùng (Users API)

Tài liệu chi tiết về API xác thực và quản lý tài khoản người dùng, sử dụng **UUID (v4)** làm khóa chính, **Access Token & Refresh Token (rf_token)** qua JWT và cơ sở dữ liệu **PostgreSQL**.

---

## 1. Thông Tin Chung

- **Base URL:** `http://localhost:5000/api/v1/users`
- **Định dạng ID:** `UUID` (Ví dụ: `e3a7b960-91a5-48b4-a698-32380598b981`).
- **Thời hạn Token:**
  - `accessToken`: **15 phút** (dùng cho các request thông thường với header `Authorization: Bearer <accessToken>`).
  - `refreshToken` (rf_token): **7 ngày** (dùng để xin cấp `accessToken` mới khi token cũ hết hạn, lưu trong cột `rf_token` ở bảng `users`).

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | Khóa chính ngẫu nhiên duy nhất (UUID v4) |
| `name` | `VARCHAR(100)` | NOT NULL | Tên người dùng |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Email duy nhất dùng để đăng nhập |
| `password` | `VARCHAR(255)` | NOT NULL | Mật khẩu băm (bcrypt hash) |
| `role` | `VARCHAR(50)` | DEFAULT 'customer' | Vai trò người dùng (`customer`, `admin`) |
| `rf_token` | `TEXT` | NULL | Refresh Token mới nhất đã được cấp |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT CURRENT_TIMESTAMP | Ngày tạo |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT CURRENT_TIMESTAMP | Ngày cập nhật |

---

## 3. Danh Sách Endpoint

### 3.1. Đăng ký tài khoản (`POST /users/register`)

- **URL:** `/api/v1/users/register`
- **Method:** `POST`
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

---

### 3.2. Đăng nhập (`POST /users/login`)

- **URL:** `/api/v1/users/login`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
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

---

### 3.3. Cấp mới Access Token (`POST /users/refresh-token` hoặc `/users/rf-token`)

- **URL:** `/api/v1/users/refresh-token` (hoặc `/api/v1/users/rf-token`)
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
  *(Hỗ trợ cả tên trường `"refreshToken"` hoặc `"rf_token"`)*
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
- **Response Thất bại (`403 Forbidden`):**
  ```json
  {
    "status": "error",
    "message": "Refresh Token không hợp lệ hoặc đã hết hạn"
  }
  ```

---

### 3.4. Lấy thông tin cá nhân (`GET /users/me`)

- **URL:** `/api/v1/users/me`
- **Method:** `GET`
- **Headers:** 
  ```http
  Authorization: Bearer <accessToken>
  ```
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
        "created_at": "2026-09-28T07:35:00.000Z",
        "updated_at": "2026-09-28T07:35:00.000Z"
      }
    }
  }
  ```

---

### 3.5. Đăng xuất (`POST /users/logout`)

Xóa bỏ `rf_token` của người dùng trong cơ sở dữ liệu để vô hiệu hóa phiên refresh token.

- **URL:** `/api/v1/users/logout`
- **Method:** `POST`
- **Headers:**
  ```http
  Authorization: Bearer <accessToken>
  ```
- **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "message": "Đăng xuất thành công"
  }
  ```
