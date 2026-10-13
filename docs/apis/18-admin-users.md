# 18. QUẢN TRỊ TÀI KHOẢN VÀ PHÂN QUYỀN (ADMIN USERS)
> **Mã phân hệ:** `USR`  
> **Phạm vi:** Quản trị viên tối cao (`admin` only)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý toàn bộ danh sách tài khoản người dùng, cấp quyền nhân viên (`manager`, `admin`), khóa/mở khóa tài khoản và xóa người dùng:
- **Quy tắc nghiệp vụ:**
  - **Quyền truy cập:** Chỉ duy nhất tài khoản có role là `admin` mới được gọi các API nhóm `USR`. Người dùng role `manager` hoặc `customer` sẽ bị chặn với mã lỗi `403 Forbidden`.
  - **Quy tắc an toàn bất khả xâm phạm:**
    - Không bao giờ cho phép xóa tài khoản của chính mình (tài khoản đang gửi request).
    - Không bao giờ cho phép xóa tài khoản mang role `admin` khác. Tài khoản admin chỉ được phép điều chỉnh, không được xóa để tránh mất quyền quản trị hệ thống.
  - Khóa tài khoản (`is_active = false`): Người dùng bị khóa sẽ lập tức bị hủy phiên refresh token và không thể đăng nhập lại vào hệ thống.

---

## 2. Thông tin chung

- **Base URL:** `/admin/users`
- **Quyền hạn truy cập:** Bắt buộc `Admin` tối cao.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **USR01** | `GET` | `/admin/users` | Admin | Danh sách tài khoản, tìm theo tên/email, lọc role |
| **USR02** | `POST` | `/admin/users` | Admin | Tạo mới tài khoản nhân viên / quản trị |
| **USR03** | `PATCH` | `/admin/users/:id` | Admin | Cập nhật thông tin, phân lại vai trò, khóa hoặc mở khóa |
| **USR04** | `DELETE` | `/admin/users/:id` | Admin | Xóa một tài khoản người dùng |
| **USR05** | `POST` | `/admin/users/bulk-delete` | Admin | Xóa hàng loạt nhiều tài khoản đã chọn |

---

## 4. Chi tiết từng Endpoint

### 4.1. USR01 — Danh sách tài khoản quản trị
- **Method:** `GET`
- **Path:** `/admin/users`
- **Query Parameters:** `role=manager&is_active=true&page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
      "name": "Trần Quản Lý",
      "email": "manager@abcshop.vn",
      "phone": "0912345678",
      "role": "manager",
      "is_active": true,
      "created_at": "2026-10-10T00:00:00.000Z",
      "updated_at": "2026-10-12T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 4.2. USR02 — Tạo tài khoản do Admin quản lý
- **Method:** `POST`
- **Path:** `/admin/users`

#### Request Body
```json
{
  "name": "Lê Nhân Viên",
  "email": "staff1@abcshop.vn",
  "role": "manager",
  "is_active": true
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "message": "Tạo tài khoản thành công",
  "data": {
    "id": "usr-new-001",
    "name": "Lê Nhân Viên",
    "email": "staff1@abcshop.vn",
    "role": "manager",
    "is_active": true,
    "created_at": "2026-10-13T10:00:00.000Z",
    "updated_at": "2026-10-13T10:00:00.000Z"
  }
}
```

---

### 4.3. USR03 — Cập nhật tài khoản và phân quyền
- **Method:** `PATCH`
- **Path:** `/admin/users/:user_id`

#### Request Body
```json
{
  "role": "manager",
  "is_active": false
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Cập nhật tài khoản thành công",
  "data": {
    "id": "usr-new-001",
    "name": "Lê Nhân Viên",
    "email": "staff1@abcshop.vn",
    "role": "manager",
    "is_active": false,
    "updated_at": "2026-10-13T10:05:00.000Z"
  }
}
```

---

### 4.4. USR04 — Xóa tài khoản
- **Method:** `DELETE`
- **Path:** `/admin/users/:user_id`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Xóa tài khoản thành công",
  "data": {
    "deleted_id": "usr-new-001"
  }
}
```
- **`400 Bad Request`**: Cố tình xóa tài khoản Admin.
```json
{
  "status": "error",
  "message": "Không được phép xóa tài khoản quản trị viên (Admin)",
  "code": "CANNOT_DELETE_ADMIN"
}
```
