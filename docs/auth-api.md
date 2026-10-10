# Tài Liệu API Xác Thực & Bảo Mật (Authentication API)

Tài liệu kỹ thuật chi tiết về các endpoint xác thực (Authentication), cấp phát và quản lý phiên người dùng cho ứng dụng **Shop API**.

---

## 1. Tổng Quan Kiến Trúc & Cơ Chế Bảo Mật

### 1.1. Phân Tách Cặp Token (Dual Token System)
Hệ thống sử dụng cơ chế cặp JSON Web Token (JWT) với mục đích phân tách rõ ràng quyền hạn:
- **`accessToken`**:
  - **Thời hạn sống (TTL):** 15 phút (`JWT_ACCESS_EXPIRES_IN=15m`).
  - **Mục đích:** Đính kèm trong header `Authorization: Bearer <accessToken>` để xác thực truy cập tài nguyên bảo vệ.
  - **Payload Claim:** Chứa `id` (UUID), `email`, `role`, `token_type: 'access'`, và `jti` (UUID ngẫu nhiên chống replay).
  - Không thể sử dụng `accessToken` tại endpoint làm mới token (`/refresh-token`).
- **`refreshToken`**:
  - **Thời hạn sống (TTL):** 7 ngày (`JWT_REFRESH_EXPIRES_IN=7d`).
  - **Mục đích:** Gửi lên endpoint `/users/refresh-token` (hoặc alias `/users/rf-token`) để xin cấp cặp token mới khi access token hết hạn.
  - **Payload Claim:** Chứa `id` (UUID), `token_type: 'refresh'`, và `jti`.
  - Không thể sử dụng `refreshToken` để gọi trực tiếp các nghiệp vụ thông thường.

### 1.2. Băm Mật Mã Refresh Token Trong Database (SHA-256 Storage)
- Refresh Token **tuyệt đối không lưu dạng văn bản thô (plain-text)** trong database.
- Cột `rf_token` trong bảng `users` chỉ lưu chuỗi băm **SHA-256** của Refresh Token.
- Khi rò rỉ dữ liệu hoặc backup SQL bị lộ, kẻ tấn công không thể sử dụng dữ liệu trong bảng để mạo danh hay cấp mới `accessToken`.

### 1.3. Refresh Token Rotation (RTR) & Phát Hiện Tái Sử Dụng (Reuse Detection)
- Mỗi lần gọi endpoint refresh token thành công, server lập tức:
  1. Hủy bỏ Refresh Token hiện tại.
  2. Phát hành một cặp `accessToken` và `refreshToken` hoàn toàn mới.
  3. Cập nhật mã băm SHA-256 của token mới vào database.
- **Xử lý Race Condition khi nhiều request đồng thời (RFC 6819 Concurrency Mitigation):** 
  - Khi ứng dụng Client (SPA/Mobile) gửi nhiều request đồng thời lúc token hết hạn, hệ thống tự động đồng bộ hóa tác vụ đang chạy (`in-flight promise deduplication`), chia sẻ cặp token mới đồng nhất cho các request đồng thời thay vì coi nhầm request đến sau là hành vi tấn công.
- **Phát hiện tái sử dụng (Reuse Detection):**
  - Nếu một Refresh Token cũ đã bị xoay vòng hoặc thu hồi nhưng lại được gửi lên tuần tự sau đó (dấu hiệu token bị rò rỉ và kẻ gian đang cố tình sử dụng lại), hệ thống sẽ:
    1. Hủy ngay lập tức phiên đăng nhập hiện tại của người dùng (`rf_token = NULL`).
    2. Trả về mã lỗi `403 Forbidden` kèm cảnh báo bảo mật, buộc đăng nhập lại từ đầu.

### 1.4. Giới Hạn Tần Suất Gửi Yêu Cầu (Rate Limiting)
- Các endpoint nhạy cảm (`/register`, `/login`, `/refresh-token`) được bảo vệ bằng Rate Limiter chống brute force và tấn công DDoS:
  - Giới hạn tối đa **10 yêu cầu / 15 phút** cho mỗi địa chỉ IP.
  - Khi vượt ngưỡng, server phản hồi mã `429 Too Many Requests`.

---

## 2. Chi Tiết Các Endpoint

### 2.1. Đăng Ký Tài Khoản (Register)
- **Mục đích:** Cho phép người dùng mới tạo tài khoản trong hệ thống. Tự động sinh ID dạng UUID v4, mã hóa mật khẩu bằng bcrypt và cấp ngay cặp token truy cập.
- **Method & Path:** `POST /api/v1/users/register`
- **Authentication/Authorization:** Không yêu cầu (Public endpoint, áp dụng `authRateLimiter`).
- **Headers:**
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Parameters:** Không có URL / Query params.
- **Request Body:**

```json
{
  "name": "Lucas Tran",
  "email": "lucas@example.com",
  "password": "Password123"
}
```

*Chú thích các trường:*
- `name` *(string, bắt buộc)*: Họ và tên người dùng (tối thiểu 1 ký tự, tự động cắt khoảng trắng thừa).
- `email` *(string, bắt buộc)*: Email hợp lệ, duy nhất trong toàn hệ thống.
- `password` *(string, bắt buộc)*: Mật khẩu thô của người dùng (tối thiểu 6 ký tự).

- **Responses:**

#### `201 Created` - Đăng ký thành công
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
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImUzYTdiOTYwLTkxYTUtNDhiNC1hNjk4LTMyMzgwNTk4Yjk4MSIsImVtYWlsIjoibHVjYXNAZXhhbXBsZS5jb20iLCJyb2xlIjoiY3VzdG9tZXIiLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzkxNTk5MTAwLCJleHAiOjE3OTE2MDAwMDB9.sample_signature_access",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImUzYTdiOTYwLTkxYTUtNDhiNC1hNjk4LTMyMzgwNTk4Yjk4MSIsImVtYWlsIjoibHVjYXNAZXhhbXBsZS5jb20iLCJyb2xlIjoiY3VzdG9tZXIiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImlhdCI6MTc5MTU5OTEwMCwiZXhwIjoxNzkyMjA0MDAwfQ.sample_signature_refresh"
  }
}
```

#### `400 Bad Request` - Dữ liệu không hợp lệ
```json
{
  "status": "error",
  "message": "Vui lòng cung cấp đầy đủ tên, email và mật khẩu"
}
```
*Các thông báo lỗi 400 khác:*
- `"Email không đúng định dạng hợp lệ"`
- `"Mật khẩu phải có ít nhất 6 ký tự"`
- `"Email đã được sử dụng"`

#### `429 Too Many Requests` - Vượt hạn mức yêu cầu
```json
{
  "status": "error",
  "message": "Quá nhiều yêu cầu xác thực từ IP của bạn, vui lòng thử lại sau 15 phút"
}
```

---

### 2.2. Đăng Nhập (Login)
- **Mục đích:** Xác thực danh tính người dùng bằng email và mật khẩu. Khi thành công, tạo mới và lưu trữ `rf_token` (được băm SHA-256) vào cơ sở dữ liệu và trả về cặp token.
- **Method & Path:** `POST /api/v1/users/login`
- **Authentication/Authorization:** Không yêu cầu (Public endpoint, áp dụng `authRateLimiter`).
- **Headers:**
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Parameters:** Không có URL / Query params.
- **Request Body:**

```json
{
  "email": "lucas@example.com",
  "password": "Password123"
}
```

*Chú thích các trường:*
- `email` *(string, bắt buộc)*: Email đã đăng ký.
- `password` *(string, bắt buộc)*: Mật khẩu tương ứng.

- **Responses:**

#### `200 OK` - Đăng nhập thành công
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
      "createdAt": "2026-10-10T13:45:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `400 Bad Request` - Thiếu dữ liệu đầu vào
```json
{
  "status": "error",
  "message": "Vui lòng nhập email và mật khẩu"
}
```

#### `401 Unauthorized` - Sai tài khoản hoặc mật khẩu
```json
{
  "status": "error",
  "message": "Email hoặc mật khẩu không chính xác"
}
```

#### `403 Forbidden` - Tài khoản bị khóa
```json
{
  "status": "error",
  "message": "Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ quản trị viên."
}
```

---

### 2.3. Cấp Mới Access Token (Refresh Token Rotation)
- **Mục đích:** Cấp phát một cặp token mới (`accessToken` và `refreshToken`) từ `refreshToken` hợp lệ mà không cần đăng nhập lại. Hỗ trợ cơ chế RTR và phát hiện token reuse.
- **Method & Path:** `POST /api/v1/users/refresh-token` *(hoặc alias `POST /api/v1/users/rf-token`)*
- **Authentication/Authorization:** Không yêu cầu Bearer token (sử dụng Refresh Token truyền trong Body).
- **Headers:**
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Parameters:** Không có.
- **Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

*Chú thích các trường:*
- `refreshToken` *(string, bắt buộc)*: Refresh token còn hạn do server phát hành (Hệ thống hỗ trợ cả tên trường `refreshToken` lẫn `rf_token`).

- **Responses:**

#### `200 OK` - Cấp mới token thành công
```json
{
  "status": "success",
  "message": "Làm mới token thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_access_token...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_rotated_refresh_token..."
  }
}
```

#### `400 Bad Request` - Không truyền token
```json
{
  "status": "error",
  "message": "Vui lòng cung cấp refreshToken hoặc rf_token"
}
```

#### `403 Forbidden` - Token hết hạn hoặc không hợp lệ
```json
{
  "status": "error",
  "message": "Refresh Token không hợp lệ hoặc đã hết hạn"
}
```

#### `403 Forbidden` - Cảnh báo tái sử dụng token (Token Reuse Attack Detected)
```json
{
  "status": "error",
  "message": "Cảnh báo bảo mật: Refresh Token không hợp lệ hoặc đã được sử dụng trước đó (nguy cơ bị chiếm đoạt). Toàn bộ phiên làm việc đã bị hủy, vui lòng đăng nhập lại."
}
```

---

### 2.4. Lấy Thông Tin Tài Khoản Hiện Tại (Get Me)
- **Mục đích:** Lấy thông tin cá nhân của người dùng đang đăng nhập dựa trên JWT Access Token.
- **Method & Path:** `GET /api/v1/users/me`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Bất kỳ người dùng đang hoạt động (`customer`, `manager`, `admin`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Parameters:** Không có.
- **Request Body:** Không có (`body: none`).
- **Responses:**

#### `200 OK` - Lấy thông tin thành công
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "e3a7b960-91a5-48b4-a698-32380598b981",
      "name": "Lucas Tran",
      "email": "lucas@example.com",
      "role": "customer",
      "phone": "0987654321",
      "address": "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
      "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
      "active": true,
      "created_at": "2026-10-10T13:45:00.000Z",
      "updated_at": "2026-10-10T13:45:00.000Z"
    }
  }
}
```

#### `401 Unauthorized` - Thiếu hoặc sai Token
```json
{
  "status": "error",
  "message": "Không tìm thấy token xác thực trong tiêu đề (Authorization header)"
}
```
*Hoặc:*
```json
{
  "status": "error",
  "message": "Token xác thực không hợp lệ hoặc đã hết hạn"
}
```

#### `403 Forbidden` - Tài khoản bị vô hiệu hóa
```json
{
  "status": "error",
  "message": "Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa"
}
```

#### `404 Not Found` - Không tìm thấy bản ghi người dùng
```json
{
  "status": "error",
  "message": "Không tìm thấy người dùng"
}
```

---

### 2.5. Đăng Xuất (Logout)
- **Mục đích:** Hủy bỏ phiên đăng nhập của người dùng bằng cách xóa sạch `rf_token` trong cơ sở dữ liệu (`rf_token = NULL`). Sau khi đăng xuất, Refresh Token hiện tại sẽ không thể tiếp tục sử dụng để lấy Access Token mới.
- **Method & Path:** `POST /api/v1/users/logout`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Parameters:** Không có.
- **Request Body:** Không có (`body: none`).
- **Responses:**

#### `200 OK` - Đăng xuất thành công
```json
{
  "status": "success",
  "message": "Đăng xuất thành công"
}
```

#### `401 Unauthorized` - Token không hợp lệ
```json
{
  "status": "error",
  "message": "Token xác thực không hợp lệ hoặc đã hết hạn"
}
```
