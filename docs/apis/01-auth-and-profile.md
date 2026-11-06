# 01. ĐĂNG KÝ, ĐĂNG NHẬP VÀ HỒ SƠ (AUTH & PROFILE)
> **Mã phân hệ:** `AUTH`  
> **Phạm vi:** Khách hàng, Quản trị viên, Nhân viên  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Phân hệ đảm nhiệm xác thực người dùng, cấp phát token JWT kép (Access Token và Refresh Token), thu hồi phiên đăng nhập, quản lý thông tin tài khoản cá nhân và đổi mật khẩu an toàn.
- **Quy tắc nghiệp vụ:**
  - `POST /api/v1/auth/register`: Đăng ký công khai, mặc định tài khoản mới luôn có role là `customer` và trạng thái `is_active = true`.
  - `POST /api/v1/auth/login`: Dùng chung cho cả khách hàng và quản trị viên (`admin`, `manager`). Nếu tài khoản bị khóa (`is_active = false`), từ chối đăng nhập với mã `403 Forbidden`.
  - `POST /api/v1/auth/logout`: Thu hồi Refresh Token trong cơ sở dữ liệu để vô hiệu hóa phiên.
  - `GET /api/v1/me`: Trả về thông tin tài khoản của chính người dùng đang đăng nhập dựa trên token.
  - `PUT /api/v1/me/password`: Yêu cầu nhập đúng `current_password` trước khi cập nhật `new_password`. Sau khi đổi mật khẩu thành công, toàn bộ refresh token cũ bị hủy lập tức.

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/auth` và `/api/v1/me`
- **Quyền hạn truy cập:**
  - `AUTH01`, `AUTH02`: Công khai (`Public`).
  - `AUTH03` — `AUTH06`: Người dùng đã đăng nhập (`Customer`, `Manager`, `Admin`).

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **AUTH01** | `POST` | `/api/v1/auth/register` | Public | Đăng ký tài khoản khách hàng mới |
| **AUTH02** | `POST` | `/api/v1/auth/login` | Public | Đăng nhập hệ thống, nhận Access Token & Cookie/Refresh Token |
| **AUTH03** | `POST` | `/api/v1/auth/logout` | Logged In | Đăng xuất và hủy phiên làm việc |
| **AUTH04** | `GET` | `/api/v1/me` | Logged In | Khôi phục phiên, lấy thông tin hồ sơ cá nhân |
| **AUTH05** | `PATCH` | `/api/v1/me` | Logged In | Cập nhật thông tin cá nhân (họ tên, số điện thoại) |
| **AUTH06** | `PUT` | `/api/v1/me/password` | Logged In | Đổi mật khẩu tài khoản hiện tại |

---

## 4. Chi tiết từng Endpoint

### 4.1. AUTH01 — Đăng ký tài khoản khách hàng
- **Method:** `POST`
- **Path:** `/api/v1/auth/register`
- **Quyền hạn:** Public

#### Request Body
```json
{
  "name": "Nguyễn Văn A",
  "email": "nguyenvana@example.com",
  "password": "Password123@",
  "password_confirmation": "Password123@"
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "message": "Đăng ký tài khoản thành công",
  "data": {
    "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "role": "customer",
    "is_active": true,
    "created_at": "2026-10-13T09:00:00.000Z"
  }
}
```
- **`409 Conflict`**: Email đã được sử dụng.
```json
{
  "status": "error",
  "message": "Email đã tồn tại trong hệ thống",
  "code": "EMAIL_EXISTS"
}
```

#### Lệnh cURL
```bash
curl -X POST "http://localhost:5000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "password": "Password123@",
    "password_confirmation": "Password123@"
  }'
```

---

### 4.2. AUTH02 — Đăng nhập hệ thống
- **Method:** `POST`
- **Path:** `/api/v1/auth/login`
- **Quyền hạn:** Public

#### Request Body
```json
{
  "email": "nguyenvana@example.com",
  "password": "Password123@"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "expires_at": "2026-10-13T09:15:00.000Z",
    "user": {
      "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@example.com",
      "phone": "0987654321",
      "role": "customer",
      "is_active": true,
      "default_address_id": null
    }
  }
}
```

#### Lệnh cURL
```bash
curl -X POST "http://localhost:5000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nguyenvana@example.com",
    "password": "Password123@"
  }'
```

---

### 4.3. AUTH03 — Đăng xuất
- **Method:** `POST`
- **Path:** `/api/v1/auth/logout`
- **Headers:** `Authorization: Bearer <token>`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Đăng xuất thành công",
  "data": {
    "success": true
  }
}
```

#### Lệnh cURL
```bash
curl -X POST "http://localhost:5000/api/v1/auth/logout" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 4.4. AUTH04 — Lấy thông tin cá nhân
- **Method:** `GET`
- **Path:** `/api/v1/me`
- **Headers:** `Authorization: Bearer <token>`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com",
    "phone": "0987654321",
    "role": "customer",
    "is_active": true,
    "default_address_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "created_at": "2026-10-13T09:00:00.000Z",
    "updated_at": "2026-10-13T09:00:00.000Z"
  }
}
```

#### Lệnh cURL
```bash
curl -X GET "http://localhost:5000/api/v1/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 4.5. AUTH05 — Cập nhật hồ sơ cá nhân
- **Method:** `PATCH`
- **Path:** `/api/v1/me`
- **Headers:** `Authorization: Bearer <token>`

#### Request Body
```json
{
  "name": "Nguyễn Văn B",
  "phone": "0912345678"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Cập nhật hồ sơ thành công",
  "data": {
    "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
    "name": "Nguyễn Văn B",
    "email": "nguyenvana@example.com",
    "phone": "0912345678",
    "role": "customer",
    "is_active": true,
    "default_address_id": null,
    "updated_at": "2026-10-13T09:30:00.000Z"
  }
}
```

---

### 4.6. AUTH06 — Đổi mật khẩu
- **Method:** `PUT`
- **Path:** `/api/v1/me/password`
- **Headers:** `Authorization: Bearer <token>`

#### Request Body
```json
{
  "current_password": "Password123@",
  "new_password": "NewSecurePassword456!",
  "new_password_confirmation": "NewSecurePassword456!"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
  "data": {
    "success": true,
    "updated_at": "2026-10-13T09:35:00.000Z"
  }
}
```
- **`400 Bad Request`**: Mật khẩu hiện tại không chính xác hoặc mật khẩu xác nhận không khớp.
```json
{
  "status": "error",
  "message": "Mật khẩu hiện tại không chính xác",
  "code": "INVALID_CURRENT_PASSWORD"
}
```
# Quên mật khẩu

- `POST /api/v1/auth/forgot-password`: body `{ "email": "customer@example.com" }`. Response 200 có `data.success: true` và thông báo trung lập, không trả token. Email tài khoản đang hoạt động nhận link dùng một lần, hết hạn sau 15 phút; gửi lại cách nhau ít nhất 60 giây.
- `POST /api/v1/auth/reset-password`: body `{ "token": "<64 hex characters>", "password": "new-password", "password_confirmation": "new-password" }`. Mật khẩu từ 6 ký tự đến 72 byte UTF-8, xác nhận bắt buộc khớp. Thành công trả 200 và `data.success: true`; link sai, hết hạn, đã dùng hoặc tài khoản bị khóa trả 400.
- Hai endpoint không yêu cầu đăng nhập, áp dụng auth rate limit. Database chỉ lưu SHA-256 của token. Việc thay mật khẩu, tiêu thụ token và tăng phiên bản phiên đăng nhập diễn ra trong cùng một UPDATE để chống dùng lại đồng thời.
- Access token, refresh token và quyền gửi/nhận chat của phiên cũ bị thu hồi. Link đang chờ cũng bị hủy khi đổi mật khẩu, đổi email hoặc khóa tài khoản qua repository.
- Email link dùng `PASSWORD_RESET_URL` được cấu hình phía server, token nằm ở fragment để không lọt vào access log/Referer. Gửi mail lỗi thì hủy token vừa tạo, ghi cảnh báo không chứa bí mật và vẫn trả thông báo trung lập.
- Local: `docker compose up -d --build --wait`, mở `http://localhost:8025` để đọc mail. Chi tiết SMTP và frontend URL ở README gốc.
