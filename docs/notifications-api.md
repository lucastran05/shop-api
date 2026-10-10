# Tài Liệu API Thông Báo Hệ Thống (Notifications API)

Tài liệu kỹ thuật chi tiết về hệ thống phát và quản lý thông báo (In-App Notifications), cấu trúc bảng PostgreSQL `notifications`, cơ chế phân luồng thông báo cá nhân vs thông báo phát sóng (Broadcast System Notifications) và phân quyền trên ứng dụng **Shop API**.

---

## 1. Cấu Trúc Bảng Dữ Liệu `notifications` (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  owner VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  key VARCHAR(100),
  params JSONB DEFAULT '{}'::jsonb,
  type VARCHAR(50) DEFAULT 'system',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
```

### Chi tiết các cột:
| Cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | Khóa chính duy nhất của từng thông báo (UUID v4) |
| `user_id` | `UUID` | FK (users) | NULL | Mã UUID của người nhận đích danh (NULL nếu phát sóng toàn hệ thống) |
| `owner` | `VARCHAR(255)`| NULL | `""` | Email người nhận dự phòng hoặc định danh đích |
| `title` | `VARCHAR(255)`| NOT NULL | - | Tiêu đề thông báo ngắn gọn |
| `message` | `TEXT` | NOT NULL | - | Nội dung chi tiết thông báo |
| `key` | `VARCHAR(100)`| NULL | NULL | Mã sự kiện nội bộ (ví dụ: `ORDER_CONFIRMED`, `PROMO_CODE`) |
| `params` | `JSONB` | NULL | `'{}'` | Dữ liệu đối số đi kèm (ví dụ: `{ "orderId": "ORD-001" }`) |
| `type` | `VARCHAR(50)` | - | `'system'` | Phân loại: `system` (hệ thống), `order` (đơn hàng), `promotion` (khuyến mãi) |
| `is_read` | `BOOLEAN` | - | `FALSE` | Trạng thái người dùng đã đọc thông báo |
| `created_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm phát thông báo |
| `updated_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm cập nhật trạng thái đã xem |

---

## 2. Cơ Chế Lọc & Phân Quyền Thông Báo (Recipient Isolation)

1. **Khách hàng thông thường (`role: customer`):**
   - Khi gọi `GET /api/v1/notifications`, hệ thống áp dụng logic lọc thông minh (`recipientMatch: true`):
     - Lấy các thông báo gửi đích danh cho tài khoản của họ (`user_id = req.user.id`).
     - **HOẶC** gửi theo email của họ (`owner = req.user.email`).
     - **HOẶC** các thông báo phát sóng chung toàn hệ thống (`user_id IS NULL AND owner IS NULL`).
   - Khách hàng không thể xem thông báo cá nhân của tài khoản khác.
2. **Nhân viên & Quản lý (`role: admin`, `manager`):**
   - Có quyền xem toàn bộ thông báo trong hệ thống, lọc thông báo theo bất kỳ `user_id` hoặc `owner` nào.
   - Là vai trò duy nhất có quyền phát thông báo mới (`POST /api/v1/notifications`).

---

## 3. Chi Tiết Các Endpoint Thông Báo

### 3.1. Lấy Danh Sách Thông Báo (Get All Notifications)
- **Mục đích:** Xem danh sách thông báo đến kèm tổng số thông báo chưa đọc (`unreadCount`), hỗ trợ phân trang và lọc theo loại hoặc trạng thái đọc.
- **Method & Path:** `GET /api/v1/notifications`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Query Parameters:**
  | Tên | Kiểu | Bắt buộc | Mặc định | Mô tả |
  | :--- | :--- | :--- | :--- | :--- |
  | `page` | `integer` | Không | `1` | Số trang cần xem |
  | `limit` | `integer` | Không | `20` | Số lượng thông báo mỗi trang |
  | `type` | `string` | Không | `""` | Lọc theo loại (`system`, `order`, `promotion`) |
  | `unread_only` | `boolean` | Không | `false` | `true`: chỉ lấy các thông báo chưa xem |
  | `user_id` | `UUID` | Không | - | Lọc theo ID người nhận *(Chỉ Admin/Manager)* |
  | `owner` | `string` | Không | - | Lọc theo email người nhận *(Chỉ Admin/Manager)* |

- **Responses:**

#### `200 OK` - Lấy thông báo thành công
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "id": "d1e2f3a4-b5c6-7890-1234-56789abcdef0",
        "userId": "e3a7b960-91a5-48b4-a698-32380598b981",
        "owner": "lucas@example.com",
        "title": "Đơn hàng ORD-2026-001 đã được xác nhận",
        "message": "Kiện hàng của bạn đang được nhân viên chuẩn bị và đóng gói.",
        "text": "Kiện hàng của bạn đang được nhân viên chuẩn bị và đóng gói.",
        "key": "ORDER_CONFIRMED",
        "params": {
          "orderId": "ORD-2026-001"
        },
        "type": "order",
        "isRead": false,
        "read": false,
        "createdAt": "2026-10-10T14:30:00.000Z",
        "updatedAt": "2026-10-10T14:30:00.000Z"
      }
    ],
    "total": 1,
    "unreadCount": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 3.2. Lấy Chi Tiết Thông Báo Theo ID (Get Notification By ID)
- **Mục đích:** Xem chi tiết một thông báo cụ thể.
- **Method & Path:** `GET /api/v1/notifications/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người nhận thông báo hoặc Admin/Manager.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Mã UUID của thông báo |

- **Responses:**

#### `200 OK` - Lấy thông tin thành công
```json
{
  "status": "success",
  "data": {
    "notification": {
      "id": "d1e2f3a4-b5c6-7890-1234-56789abcdef0",
      "userId": "e3a7b960-91a5-48b4-a698-32380598b981",
      "owner": "lucas@example.com",
      "title": "Đơn hàng ORD-2026-001 đã được xác nhận",
      "message": "Kiện hàng của bạn đang được nhân viên chuẩn bị và đóng gói.",
      "type": "order",
      "isRead": false,
      "createdAt": "2026-10-10T14:30:00.000Z"
    }
  }
}
```

#### `403 Forbidden` - Không có quyền xem thông báo người khác
```json
{
  "status": "error",
  "message": "Bạn không có quyền xem thông báo này"
}
```

#### `404 Not Found` - Không tìm thấy thông báo
```json
{
  "status": "error",
  "message": "Không tìm thấy thông báo"
}
```

---

### 3.3. Tạo Thông Báo Mới (Create Notification)
- **Mục đích:** Quản trị viên phát thông báo khuyến mãi, bảo trì hệ thống tới toàn bộ người dùng hoặc gửi thông báo riêng biệt cho một tài khoản.
- **Method & Path:** `POST /api/v1/notifications`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Request Body:**

```json
{
  "title": "Ưu Đãi Siêu Sale Cuối Tuần",
  "message": "Giảm ngay 20% cho toàn bộ linh kiện máy tính khi thanh toán qua chuyển khoản!",
  "type": "promotion",
  "user_id": null,
  "owner": "",
  "key": "WEEKEND_PROMO_2026",
  "params": {
    "discountPercent": 20,
    "event": "SuperWeekend"
  }
}
```

*Chú thích các trường:*
- `title` *(string, bắt buộc)*: Tiêu đề thông báo.
- `message` *(string, bắt buộc)*: Nội dung chi tiết (hỗ trợ cả alias field `text`).
- `type` *(string, tùy chọn)*: Loại thông báo (`system`, `order`, `promotion`).
- `user_id` *(UUID, tùy chọn)*: Để `null` nếu muốn phát sóng toàn sàn.
- `owner` *(string, tùy chọn)*: Email người nhận cụ thể (nếu có).
- `key` *(string, tùy chọn)*: Mã nghiệp vụ.
- `params` *(object, tùy chọn)*: Dữ liệu biến động đính kèm.

- **Responses:**

#### `201 Created` - Tạo thông báo thành công
```json
{
  "status": "success",
  "message": "Tạo thông báo thành công",
  "data": {
    "notification": {
      "id": "f5a6b7c8-9012-3456-789a-bcdef0123456",
      "userId": null,
      "owner": "",
      "title": "Ưu Đãi Siêu Sale Cuối Tuần",
      "message": "Giảm ngay 20% cho toàn bộ linh kiện máy tính khi thanh toán qua chuyển khoản!",
      "type": "promotion",
      "isRead": false,
      "createdAt": "2026-10-10T14:40:00.000Z"
    }
  }
}
```

#### `400 Bad Request` - Thiếu tiêu đề
```json
{
  "status": "error",
  "message": "Tiêu đề thông báo không được để trống"
}
```

---

### 3.4. Đánh Dấu Một Thông Báo Đã Đọc (Mark As Read)
- **Mục đích:** Cập nhật trạng thái `is_read = true` khi người dùng bấm vào thông báo.
- **Method & Path:** `PATCH /api/v1/notifications/:id/read`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người nhận hoặc Admin/Manager.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của thông báo |

- **Responses:**

#### `200 OK` - Cập nhật thành công
```json
{
  "status": "success",
  "message": "Đã đánh dấu thông báo là đã đọc",
  "data": {
    "notification": {
      "id": "d1e2f3a4-b5c6-7890-1234-56789abcdef0",
      "userId": "e3a7b960-91a5-48b4-a698-32380598b981",
      "isRead": true,
      "read": true
    }
  }
}
```

---

### 3.5. Đánh Dấu Tất Cả Thông Báo Là Đã Đọc (Mark All As Read)
- **Mục đích:** Người dùng bấm "Đánh dấu tất cả đã đọc" để reset số đếm thông báo chưa xem về 0.
- **Method & Path:** `PATCH /api/v1/notifications/mark-all-read`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Request Body (Tùy chọn đối với Admin):**
```json
{
  "owner": "lucas@example.com"
}
```

- **Responses:**

#### `200 OK` - Đánh dấu thành công
```json
{
  "status": "success",
  "message": "Đã đánh dấu 3 thông báo là đã đọc",
  "data": {
    "updatedCount": 3
  }
}
```

---

### 3.6. Xóa Một Thông Báo (Delete Notification)
- **Mục đích:** Xóa một thông báo cụ thể ra khỏi hộp thư.
- **Method & Path:** `DELETE /api/v1/notifications/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người nhận hoặc Admin/Manager.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Mã UUID của thông báo cần xóa |

- **Responses:**

#### `200 OK` - Xóa thành công
```json
{
  "status": "success",
  "message": "Xóa thông báo thành công"
}
```

---

### 3.7. Dọn Sạch Các Thông Báo Đã Đọc (Clear Read Notifications)
- **Mục đích:** Xóa toàn bộ các thông báo đã đọc (`is_read = true`) của tài khoản hiện tại để làm gọn hộp thư.
- **Method & Path:** `DELETE /api/v1/notifications/clear-read`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Request Body (Tùy chọn đối với Admin):**
```json
{
  "owner": "lucas@example.com"
}
```

- **Responses:**

#### `200 OK` - Dọn dẹp thành công
```json
{
  "status": "success",
  "message": "Đã xóa 5 thông báo đã đọc",
  "data": {
    "deletedCount": 5
  }
}
```
