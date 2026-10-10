# Tài Liệu API Thanh Toán (Payments API)

Tài liệu kỹ thuật chi tiết về các endpoint xử lý giao dịch thanh toán (Payments & Transactions), cấu trúc bảng PostgreSQL, cơ chế cô lập dữ liệu theo người dùng và phân quyền cập nhật trạng thái đơn hàng cho ứng dụng **Shop API**.

---

## 1. Cấu Trúc Bảng Dữ Liệu `payments` (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'bank',
  payment_type VARCHAR(50) DEFAULT 'full',
  status VARCHAR(50) DEFAULT 'pending',
  transaction_id VARCHAR(255),
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Chi tiết các cột:
| Cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | Mã định danh duy nhất của giao dịch thanh toán (UUID v4) |
| `order_id` | `VARCHAR(100)` | NOT NULL | - | Mã đơn hàng tương ứng (ví dụ: `ORD-2026-001`) |
| `user_id` | `UUID` | FK (users) | NULL | Mã UUID của người thực hiện thanh toán |
| `amount` | `DECIMAL(12,2)`| NOT NULL | `0` | Số tiền thanh toán (VNĐ) |
| `payment_method`| `VARCHAR(50)`| - | `'bank'` | Phương thức thanh toán (`bank`, `momo`, `vnpay`, `cash`, `cod`) |
| `payment_type`| `VARCHAR(50)` | - | `'full'` | Loại thanh toán (`full`: thanh toán toàn bộ, `deposit`: đặt cọc) |
| `status` | `VARCHAR(50)` | - | `'pending'`| Trạng thái: `pending`, `completed`, `failed`, `cancelled`, `refunded` |
| `transaction_id`| `VARCHAR(255)`| NULL | NULL | Mã tham chiếu giao dịch từ phía cổng thanh toán hoặc ngân hàng |
| `note` | `TEXT` | NULL | `""` | Ghi chú thêm từ khách hàng hoặc thủ quỹ |
| `metadata` | `JSONB` | NULL | `'{}'` | Dữ liệu bổ sung dạng JSON (thông tin ngân hàng, mã phản hồi cổng) |
| `created_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm phát sinh giao dịch |
| `updated_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm cập nhật trạng thái giao dịch |

---

## 2. Nguyên Tắc Bảo Mật & Cô Lập Dữ Liệu (Data Isolation)

1. **Bắt buộc xác thực danh tính:** Toàn bộ các route `/api/v1/payments/*` đều được bảo vệ bởi middleware `verifyAuth`.
2. **Cô lập theo khách hàng:**
   - Khi khách hàng (`role: customer`) gọi `GET /api/v1/payments`, hệ thống **tự động gán cứng `user_id = req.user.id`**, đảm bảo khách hàng không thể soi mói lịch sử thanh toán của tài khoản khác.
   - Khi tạo thanh toán `POST /api/v1/payments`, `user_id` bắt buộc lấy từ thông tin token của chính người đăng nhập.
3. **Quyền hạn quản lý:**
   - Chỉ `admin` và `manager` mới có quyền xem toàn bộ giao dịch, lọc theo `user_id` tùy ý, chỉnh sửa hoặc cập nhật trạng thái giao dịch (`PATCH /status`).
   - Chỉ `admin` tối cao mới có quyền xóa bản ghi thanh toán (`DELETE`).

---

## 3. Chi Tiết Các Endpoint Thanh Toán

### 3.1. Lấy Danh Sách Giao Dịch Thanh Toán (Get All Payments)
- **Mục đích:** Khách hàng xem lịch sử thanh toán của bản thân. Quản trị viên/quản lý xem danh sách tất cả các giao dịch toàn hệ thống có phân trang và bộ lọc nâng cao.
- **Method & Path:** `GET /api/v1/payments`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Bất kỳ người dùng hợp lệ.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Query Parameters:**
  | Tên | Kiểu | Bắt buộc | Mặc định | Mô tả |
  | :--- | :--- | :--- | :--- | :--- |
  | `page` | `integer` | Không | `1` | Số thứ tự trang |
  | `limit` | `integer` | Không | `20` | Số lượng bản ghi trên một trang |
  | `order_id` | `string` | Không | `""` | Tìm kiếm theo mã đơn hàng |
  | `user_id` | `UUID` | Không | - | Lọc theo ID người dùng *(Chỉ Admin/Manager)* |
  | `status` | `string` | Không | `""` | Lọc theo trạng thái (`pending`, `completed`, `failed`,...) |
  | `payment_method` | `string` | Không | `""` | Lọc theo phương thức (`bank`, `momo`, `vnpay`,...) |
  | `payment_type` | `string` | Không | `""` | Lọc theo loại (`full`, `deposit`) |

- **Responses:**

#### `200 OK` - Lấy danh sách thành công
```json
{
  "status": "success",
  "data": {
    "payments": [
      {
        "id": "98f5a2b1-1234-4567-89ab-cdef01234567",
        "order_id": "ORD-2026-001",
        "user_id": "e3a7b960-91a5-48b4-a698-32380598b981",
        "amount": "2500000.00",
        "payment_method": "bank",
        "payment_type": "full",
        "status": "completed",
        "transaction_id": "TXN_VN_20261010_001",
        "note": "Khách chuyển khoản Vietcombank",
        "metadata": {
          "bank_code": "VCB",
          "account_holder": "LUCAS TRAN"
        },
        "created_at": "2026-10-10T14:00:00.000Z",
        "updated_at": "2026-10-10T14:05:00.000Z",
        "user_name": "Lucas Tran",
        "user_email": "lucas@example.com"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 3.2. Lấy Chi Tiết Thanh Toán Theo ID (Get Payment By ID)
- **Mục đích:** Xem chi tiết một giao dịch thanh toán cụ thể.
- **Method & Path:** `GET /api/v1/payments/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người yêu cầu phải là **Chính chủ giao dịch** hoặc có vai trò `admin`, `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của bản ghi thanh toán |

- **Responses:**

#### `200 OK` - Lấy thông tin thành công
```json
{
  "status": "success",
  "data": {
    "payment": {
      "id": "98f5a2b1-1234-4567-89ab-cdef01234567",
      "order_id": "ORD-2026-001",
      "user_id": "e3a7b960-91a5-48b4-a698-32380598b981",
      "amount": "2500000.00",
      "payment_method": "bank",
      "payment_type": "full",
      "status": "completed",
      "transaction_id": "TXN_VN_20261010_001",
      "note": "Khách chuyển khoản Vietcombank",
      "metadata": {
        "bank_code": "VCB"
      },
      "created_at": "2026-10-10T14:00:00.000Z",
      "updated_at": "2026-10-10T14:05:00.000Z",
      "user_name": "Lucas Tran",
      "user_email": "lucas@example.com"
    }
  }
}
```

#### `403 Forbidden` - Xem trộm thanh toán người khác
```json
{
  "status": "error",
  "message": "Bạn không có quyền xem thông tin giao dịch này"
}
```

#### `404 Not Found` - Không tìm thấy bản ghi
```json
{
  "status": "error",
  "message": "Không tìm thấy bản ghi thanh toán"
}
```

---

### 3.3. Lấy Danh Sách Thanh Toán Của Một Đơn Hàng (Get By Order ID)
- **Mục đích:** Lấy toàn bộ các lần thanh toán (đặt cọc đợt 1, thanh toán phần còn lại đợt 2,...) gắn với một mã đơn hàng.
- **Method & Path:** `GET /api/v1/payments/order/:orderId`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người gửi phải là người đặt đơn hàng đó hoặc có vai trò `admin`, `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `orderId` | `string` | Có | Mã đơn hàng (ví dụ: `ORD-2026-001`) |

- **Responses:**

#### `200 OK` - Lấy dữ liệu thành công
```json
{
  "status": "success",
  "data": {
    "payments": [
      {
        "id": "98f5a2b1-1234-4567-89ab-cdef01234567",
        "order_id": "ORD-2026-001",
        "user_id": "e3a7b960-91a5-48b4-a698-32380598b981",
        "amount": "500000.00",
        "payment_method": "bank",
        "payment_type": "deposit",
        "status": "completed",
        "created_at": "2026-10-10T10:00:00.000Z"
      },
      {
        "id": "87e4a1b0-9876-5432-10fe-dcba98765432",
        "order_id": "ORD-2026-001",
        "user_id": "e3a7b960-91a5-48b4-a698-32380598b981",
        "amount": "2000000.00",
        "payment_method": "bank",
        "payment_type": "full",
        "status": "completed",
        "created_at": "2026-10-10T14:00:00.000Z"
      }
    ]
  }
}
```

---

### 3.4. Tạo Bản Ghi Thanh Toán Mới (Create Payment)
- **Mục đích:** Khách hàng hoặc thủ quỹ tạo thông tin thanh toán cho đơn hàng.
- **Method & Path:** `POST /api/v1/payments`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Bất kỳ người dùng hợp lệ.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
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
  "metadata": {
    "bank_code": "VCB",
    "account_number": "1012345678",
    "account_holder": "LUCAS TRAN"
  }
}
```

*Chú thích các trường:*
- `order_id` *(string, bắt buộc)*: Mã đơn hàng.
- `amount` *(number, bắt buộc)*: Số tiền thanh toán (phải lớn hơn 0).
- `payment_method` *(string, tùy chọn)*: Hình thức (`bank`, `cash`, `momo`, `vnpay`,...).
- `payment_type` *(string, tùy chọn)*: Loại (`full` hoặc `deposit`).
- `status` *(string, tùy chọn)*: Trạng thái ban đầu (mặc định `'pending'`).
- `metadata` *(object, tùy chọn)*: Thông tin mở rộng.

- **Responses:**

#### `201 Created` - Tạo thành công
```json
{
  "status": "success",
  "message": "Tạo bản ghi thanh toán thành công",
  "data": {
    "payment": {
      "id": "98f5a2b1-1234-4567-89ab-cdef01234567",
      "order_id": "ORD-2026-001",
      "user_id": "e3a7b960-91a5-48b4-a698-32380598b981",
      "amount": "2500000.00",
      "payment_method": "bank",
      "payment_type": "full",
      "status": "pending",
      "transaction_id": "TXN_VN_20261010_001",
      "note": "Khách chuyển khoản Vietcombank",
      "metadata": {
        "bank_code": "VCB",
        "account_number": "1012345678",
        "account_holder": "LUCAS TRAN"
      },
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
  "message": "Mã đơn hàng không được để trống"
}
```
*Hoặc:*
```json
{
  "status": "error",
  "message": "Số tiền thanh toán phải lớn hơn 0"
}
```

---

### 3.5. Cập Nhật Thông Tin Thanh Toán (Update Payment)
- **Mục đích:** Kế toán hoặc Quản lý cập nhật số tiền, mã tham chiếu hoặc ghi chú đối soát.
- **Method & Path:** `PUT /api/v1/payments/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của bản ghi thanh toán |

- **Request Body:**

```json
{
  "amount": 2500000,
  "payment_method": "bank",
  "status": "completed",
  "transaction_id": "TXN_VN_20261010_001_CONFIRMED",
  "note": "Kế toán đã đối soát ngân hàng thành công"
}
```

- **Responses:**

#### `200 OK` - Cập nhật thành công
```json
{
  "status": "success",
  "message": "Cập nhật thanh toán thành công",
  "data": {
    "payment": {
      "id": "98f5a2b1-1234-4567-89ab-cdef01234567",
      "order_id": "ORD-2026-001",
      "amount": "2500000.00",
      "status": "completed",
      "transaction_id": "TXN_VN_20261010_001_CONFIRMED",
      "note": "Kế toán đã đối soát ngân hàng thành công",
      "updated_at": "2026-10-10T14:20:00.000Z"
    }
  }
}
```

---

### 3.6. Cập Nhật Nhanh Trạng Thái Thanh Toán (Update Status)
- **Mục đích:** Thu ngân hoặc webhook ngân hàng cập nhật trạng thái thanh toán (`completed`, `failed`, `refunded`,...).
- **Method & Path:** `PATCH /api/v1/payments/:id/status`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của bản ghi thanh toán |

- **Request Body:**

```json
{
  "status": "completed"
}
```

- **Responses:**

#### `200 OK` - Cập nhật trạng thái thành công
```json
{
  "status": "success",
  "message": "Cập nhật trạng thái thanh toán thành công",
  "data": {
    "payment": {
      "id": "98f5a2b1-1234-4567-89ab-cdef01234567",
      "order_id": "ORD-2026-001",
      "status": "completed",
      "updated_at": "2026-10-10T14:25:00.000Z"
    }
  }
}
```

#### `400 Bad Request` - Thiếu trạng thái
```json
{
  "status": "error",
  "message": "Vui lòng cung cấp trạng thái mới"
}
```

---

### 3.7. Xóa Bản Ghi Thanh Toán (Delete Payment)
- **Mục đích:** Xóa bản ghi thanh toán bị trùng hoặc tạo sai.
- **Method & Path:** `DELETE /api/v1/payments/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của bản ghi thanh toán cần xóa |

- **Responses:**

#### `200 OK` - Xóa thành công
```json
{
  "status": "success",
  "message": "Xóa bản ghi thanh toán thành công"
}
```

#### `403 Forbidden` - Không phải Admin
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin)"
}
```

#### `404 Not Found` - Không tìm thấy bản ghi
```json
{
  "status": "error",
  "message": "Không tìm thấy bản ghi thanh toán để xóa"
}
```
