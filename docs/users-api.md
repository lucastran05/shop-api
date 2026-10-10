# Tài Liệu API Quản Lý Người Dùng & Phân Quyền (Users API & RBAC)

Tài liệu chi tiết về API quản lý người dùng (User Management), cấu trúc cơ sở dữ liệu PostgreSQL, phân quyền theo vai trò (Role-Based Access Control - RBAC) và các chính sách bảo mật cho ứng dụng **Shop API**.

---

## 1. Cấu Trúc Bảng Dữ Liệu `users` (PostgreSQL)

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

### Chi tiết các cột:
| Cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | Định danh người dùng duy nhất toàn cầu (UUID v4) |
| `name` | `VARCHAR(100)` | NOT NULL | - | Họ và tên người dùng |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | - | Địa chỉ email đăng nhập (chuẩn hóa chữ thường) |
| `password` | `VARCHAR(255)` | NOT NULL | - | Chuỗi mật khẩu đã được băm (bcrypt hash) |
| `role` | `VARCHAR(50)` | - | `'customer'` | Vai trò người dùng (`customer`, `manager`, `admin`) |
| `rf_token` | `TEXT` | NULL | NULL | Chuỗi băm SHA-256 của Refresh Token mới nhất |
| `phone` | `VARCHAR(25)` | NULL | NULL | Số điện thoại liên hệ |
| `address` | `TEXT` | NULL | NULL | Địa chỉ giao hàng mặc định |
| `avatar` | `TEXT` | NULL | NULL | Đường dẫn ảnh đại diện (URL) |
| `active` | `BOOLEAN` | - | `TRUE` | Trạng thái tài khoản (`true`: hoạt động, `false`: khóa) |
| `created_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm tạo bản ghi |
| `updated_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm cập nhật bản ghi gần nhất |

---

## 2. Ma Trận Phân Quyền (RBAC) & Nguyên Tắc Bảo Mật

### 2.1. Ma Trận Quyền Truy Cập
| Endpoint | Phương thức | Vai trò cho phép | Ghi chú kiểm soát quyền |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/users` | `GET` | `admin`, `manager` | Quản trị viên/quản lý xem danh sách người dùng toàn hệ thống |
| `POST /api/v1/users` | `POST` | `admin` | Chỉ `admin` mới được tạo người dùng trực tiếp kèm chọn role |
| `GET /api/v1/users/:id` | `GET` | `admin`, `manager`, hoặc **Chính chủ** | Khách hàng chỉ xem được chính mình; nhân viên xem được người khác |
| `PUT /api/v1/users/:id` | `PUT` | `admin`, hoặc **Chính chủ** | Khách hàng sửa thông tin bản thân; Chống đổi `role` và `active` |
| `DELETE /api/v1/users/:id` | `DELETE` | `admin` | Xóa tài khoản; Chặn admin tự xóa tài khoản của chính mình |

### 2.2. Chống Leo Thang Đặc Quyền (Privilege Escalation Protection)
- Khi người dùng thông thường (`role: customer`) thực hiện cập nhật tại `PUT /api/v1/users/:id`, hệ thống tự động loại bỏ các trường `role` và `active` khỏi payload cập nhật (`delete updatePayload.role`, `delete updatePayload.active`).
- Quản trị viên (`admin`) là vai trò duy nhất có thể phân quyền hoặc thay đổi trạng thái kích hoạt của người dùng khác.

### 2.3. Thu Hồi Phiên Đăng Nhập Tức Thì (Session Revocation)
- **Đổi mật khẩu:** Khi mật khẩu của người dùng được cập nhật thành công, toàn bộ `rf_token` trong DB sẽ bị hủy ngay lập tức (`rf_token = NULL`).
- **Khóa tài khoản (`active: false`):** Ngay khi tài khoản bị vô hiệu hóa, `rf_token` bị thu hồi ngay lập tức, chặn làm mới token và chặn đăng nhập tại tất cả các thiết bị.

---

## 3. Chi Tiết Các Endpoint Quản Lý Người Dùng

### 3.1. Lấy Danh Sách Người Dùng (Get All Users)
- **Mục đích:** Xem danh sách người dùng toàn hệ thống có hỗ trợ phân trang, tìm kiếm theo từ khóa và lọc theo vai trò, trạng thái kích hoạt.
- **Method & Path:** `GET /api/v1/users`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Query Parameters:**
  | Tên | Kiểu | Bắt buộc | Mặc định | Mô tả |
  | :--- | :--- | :--- | :--- | :--- |
  | `page` | `integer` | Không | `1` | Số thứ tự trang (bắt đầu từ 1) |
  | `limit` | `integer` | Không | `20` | Số lượng bản ghi trên một trang |
  | `search` | `string` | Không | `""` | Từ khóa tìm kiếm theo tên hoặc email |
  | `role` | `string` | Không | `""` | Lọc theo vai trò: `customer`, `manager`, `admin` |
  | `active` | `boolean` | Không | `""` | Lọc theo trạng thái: `true` (hoạt động), `false` (khóa) |

- **Request Body:** Không có.
- **Responses:**

#### `200 OK` - Lấy danh sách thành công
```json
{
  "status": "success",
  "data": {
    "users": [
      {
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
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### `401 Unauthorized` - Chưa xác thực
```json
{
  "status": "error",
  "message": "Token xác thực không hợp lệ hoặc đã hết hạn"
}
```

#### `403 Forbidden` - Không đủ quyền hạn
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin, manager)"
}
```

---

### 3.2. Lấy Chi Tiết Người Dùng Theo ID (Get User By ID)
- **Mục đích:** Xem chi tiết hồ sơ của một tài khoản theo mã UUID.
- **Method & Path:** `GET /api/v1/users/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người yêu cầu phải là **Chính chủ tài khoản** hoặc có vai trò `admin`, `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh duy nhất (UUID v4) của người dùng cần xem |

- **Request Body:** Không có.
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

#### `403 Forbidden` - Không có quyền xem tài khoản của người khác
```json
{
  "status": "error",
  "message": "Bạn không có quyền xem thông tin của người dùng này"
}
```

#### `404 Not Found` - Không tìm thấy ID
```json
{
  "status": "error",
  "message": "Không tìm thấy người dùng"
}
```

---

### 3.3. Tạo Người Dùng Mới Qua Quyền Quản Trị (Create User)
- **Mục đích:** Quản trị viên chủ động tạo tài khoản cho nhân viên hoặc khách hàng với vai trò và trạng thái tùy chọn.
- **Method & Path:** `POST /api/v1/users`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Parameters:** Không có.
- **Request Body:**

```json
{
  "name": "Trần Văn Quản Lý",
  "email": "manager01@shop.vn",
  "password": "ManagerPass123",
  "role": "manager",
  "phone": "0912345678",
  "address": "456 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
  "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
  "active": true
}
```

*Chú thích các trường:*
- `name` *(string, bắt buộc)*: Họ và tên.
- `email` *(string, bắt buộc)*: Email hợp lệ và duy nhất.
- `password` *(string, tùy chọn)*: Mật khẩu khởi tạo (mặc định `'123456'` nếu bỏ trống).
- `role` *(string, tùy chọn)*: Vai trò (`customer`, `manager`, `admin`, mặc định `'customer'`).
- `phone` *(string, tùy chọn)*: Số điện thoại liên hệ.
- `address` *(string, tùy chọn)*: Địa chỉ liên hệ.
- `avatar` *(string, tùy chọn)*: Link ảnh đại diện.
- `active` *(boolean, tùy chọn)*: Trạng thái kích hoạt (mặc định `true`).

- **Responses:**

#### `201 Created` - Tạo thành công
```json
{
  "status": "success",
  "message": "Tạo người dùng thành công",
  "data": {
    "user": {
      "id": "c4d5e6f7-8901-2345-6789-abcdef012345",
      "name": "Trần Văn Quản Lý",
      "email": "manager01@shop.vn",
      "role": "manager",
      "phone": "0912345678",
      "address": "456 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
      "active": true,
      "created_at": "2026-10-10T14:00:00.000Z",
      "updated_at": "2026-10-10T14:00:00.000Z"
    }
  }
}
```

#### `400 Bad Request` - Dữ liệu không hợp lệ
```json
{
  "status": "error",
  "message": "Vui lòng cung cấp tên và email"
}
```
*Hoặc:*
```json
{
  "status": "error",
  "message": "Email đã được sử dụng"
}
```

#### `403 Forbidden` - Không phải Admin
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin)"
}
```

---

### 3.4. Cập Nhật Thông Tin Người Dùng (Update User)
- **Mục đích:** Cập nhật thông tin hồ sơ người dùng. Người dùng tự sửa thông tin của mình hoặc Admin sửa thông tin của bất kỳ ai. Tự động áp dụng cơ chế chống leo thang quyền hạn và vô hiệu hóa phiên cũ nếu đổi mật khẩu.
- **Method & Path:** `PUT /api/v1/users/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người yêu cầu phải là **Chính chủ tài khoản** hoặc có vai trò `admin`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của người dùng cần cập nhật |

- **Request Body:**

```json
{
  "name": "Lucas Tran Cập Nhật",
  "phone": "0987654321",
  "address": "789 Đường 3 Tháng 2, Quận 10, TP.HCM",
  "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
  "password": "NewSecretPassword456",
  "role": "admin",
  "active": true
}
```

*Lưu ý bảo mật:* Nếu người gửi yêu cầu không phải `admin`, các trường `role` và `active` sẽ tự động bị lược bỏ nhằm chống tấn công leo thang quyền lực.

- **Responses:**

#### `200 OK` - Cập nhật thành công
```json
{
  "status": "success",
  "message": "Cập nhật thông tin người dùng thành công",
  "data": {
    "user": {
      "id": "e3a7b960-91a5-48b4-a698-32380598b981",
      "name": "Lucas Tran Cập Nhật",
      "email": "lucas@example.com",
      "role": "customer",
      "phone": "0987654321",
      "address": "789 Đường 3 Tháng 2, Quận 10, TP.HCM",
      "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
      "active": true,
      "created_at": "2026-10-10T13:45:00.000Z",
      "updated_at": "2026-10-10T14:15:00.000Z"
    }
  }
}
```

#### `400 Bad Request` - Mật khẩu mới quá ngắn
```json
{
  "status": "error",
  "message": "Mật khẩu mới phải có ít nhất 6 ký tự"
}
```

#### `403 Forbidden` - Sửa trái phép người dùng khác
```json
{
  "status": "error",
  "message": "Bạn không có quyền chỉnh sửa thông tin người dùng khác"
}
```

#### `404 Not Found` - Không tìm thấy người dùng
```json
{
  "status": "error",
  "message": "Không tìm thấy người dùng để cập nhật"
}
```

---

### 3.5. Xóa Người Dùng (Delete User)
- **Mục đích:** Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống. Ngăn chặn quản trị viên tự xóa tài khoản của chính mình để tránh mất quyền quản trị.
- **Method & Path:** `DELETE /api/v1/users/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của tài khoản cần xóa |

- **Request Body:** Không có.
- **Responses:**

#### `200 OK` - Xóa thành công
```json
{
  "status": "success",
  "message": "Xóa người dùng thành công"
}
```

#### `400 Bad Request` - Admin tự xóa chính mình
```json
{
  "status": "error",
  "message": "Không thể xóa tài khoản của chính bạn đang sử dụng"
}
```

#### `403 Forbidden` - Không phải Admin
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin)"
}
```

#### `404 Not Found` - Không tìm thấy tài khoản để xóa
```json
{
  "status": "error",
  "message": "Không tìm thấy người dùng để xóa"
}
```
