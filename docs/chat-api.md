# Tài Liệu API Tin Nhắn & Hỗ Trợ Trực Tuyến (Chat API)

Tài liệu kỹ thuật chi tiết về hệ thống tin nhắn hỗ trợ khách hàng (Live Chat / Messaging), cấu trúc bảng PostgreSQL `chat_messages`, luồng trao đổi giữa khách hàng và nhân viên hỗ trợ, cùng cơ chế phân quyền bảo mật trên ứng dụng **Shop API**.

---

## 1. Cấu Trúc Bảng Dữ Liệu `chat_messages` (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255),
  owner VARCHAR(255) NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name VARCHAR(100),
  sender_role VARCHAR(50) DEFAULT 'customer',
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_owner ON chat_messages(owner);
CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id);
```

### Chi tiết các cột:
| Cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | Khóa chính duy nhất của từng tin nhắn (UUID v4) |
| `conversation_id` | `VARCHAR(255)`| NULL | NULL | Mã phân loại phòng chat (mặc định lấy theo `owner`) |
| `owner` | `VARCHAR(255)`| NOT NULL | - | Email của khách hàng sở hữu cuộc hội thoại (Session Owner) |
| `sender_id` | `UUID` | FK (users) | NULL | Mã UUID của người gửi tin nhắn |
| `sender_name` | `VARCHAR(100)`| NULL | `""` | Tên người gửi hiển thị trên giao diện |
| `sender_role` | `VARCHAR(50)` | - | `'customer'` | Vai trò người gửi (`customer`, `shop`, `admin`, `manager`) |
| `message` | `TEXT` | NOT NULL | - | Nội dung văn bản tin nhắn |
| `is_read` | `BOOLEAN` | - | `FALSE` | Trạng thái đã xem tin nhắn |
| `created_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm gửi tin nhắn |
| `updated_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm cập nhật tin nhắn gần nhất |

---

## 2. Nguyên Tắc Hoạt Động & Cơ Chế Bảo Mật

1. **Khách hàng thường (`role: customer`):**
   - Chỉ được phép gửi và đọc tin nhắn trong cuộc hội thoại của chính mình (`owner = req.user.email`).
   - Server tự động gán `sender_id = req.user.id`, `sender_name = req.user.name`, `sender_role = 'customer'`, và `owner = req.user.email`. Khách hàng không thể giả mạo nhân viên shop hoặc gửi tin nhắn vào hộp thư của người khác.
2. **Nhân viên hỗ trợ & Quản lý (`role: admin`, `manager`):**
   - Có quyền xem toàn bộ danh sách các cuộc hội thoại (`GET /conversations`) kèm số tin nhắn chưa đọc của từng khách hàng.
   - Khi trả lời khách hàng, nhân viên chỉ định `owner = <email_khách_hàng>` và `sender_role = 'shop'`.

---

## 3. Chi Tiết Các Endpoint Chat

### 3.1. Lấy Danh Sách Các Cuộc Hội Thoại (Get Conversations)
- **Mục đích:** Nhân viên CSKH/Quản lý xem tổng quan danh sách toàn bộ các khách hàng đang nhắn tin, tin nhắn gần nhất và số lượng tin nhắn chưa đọc.
- **Method & Path:** `GET /api/v1/chat/conversations`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Responses:**

#### `200 OK` - Lấy danh sách thành công
```json
{
  "status": "success",
  "data": {
    "conversations": [
      {
        "owner": "lucas@example.com",
        "conversationId": "lucas@example.com",
        "senderName": "Lucas Tran",
        "lastMessage": {
          "id": "e2a1b0c9-8765-4321-fedc-ba9876543210",
          "message": "Shop còn bàn phím không ạ?",
          "text": "Shop còn bàn phím không ạ?",
          "from": "customer",
          "senderRole": "customer",
          "at": "2026-10-10T14:45:00.000Z",
          "isRead": false
        },
        "unreadCount": 1,
        "updatedAt": "2026-10-10T14:45:00.000Z"
      }
    ]
  }
}
```

#### `403 Forbidden` - Khách hàng không có quyền xem tổng quan
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin, manager)"
}
```

---

### 3.2. Lấy Danh Sách Tin Nhắn (Get Messages)
- **Mục đích:** Xem lịch sử trao đổi tin nhắn có phân trang. Khách hàng chỉ xem tin nhắn của mình; Nhân viên có thể lọc theo `owner`.
- **Method & Path:** `GET /api/v1/chat/messages`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Query Parameters:**
  | Tên | Kiểu | Bắt buộc | Mặc định | Mô tả |
  | :--- | :--- | :--- | :--- | :--- |
  | `owner` | `string` | Không | - | Email chủ cuộc trò chuyện *(Chỉ nhân viên mới được truyền)* |
  | `conversation_id`| `string` | Không | `""` | Lọc theo mã phòng chat |
  | `page` | `integer` | Không | `1` | Số thứ tự trang |
  | `limit` | `integer` | Không | `50` | Số lượng tin nhắn mỗi trang |
  | `unread_only` | `boolean` | Không | `false` | `true`: chỉ lấy tin nhắn chưa đọc |

- **Responses:**

#### `200 OK` - Lấy tin nhắn thành công
```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "e2a1b0c9-8765-4321-fedc-ba9876543210",
        "conversationId": "lucas@example.com",
        "senderId": "e3a7b960-91a5-48b4-a698-32380598b981",
        "senderName": "Lucas Tran",
        "owner": "lucas@example.com",
        "senderRole": "customer",
        "from": "customer",
        "message": "Shop còn bàn phím không ạ?",
        "text": "Shop còn bàn phím không ạ?",
        "isRead": false,
        "createdAt": "2026-10-10T14:45:00.000Z",
        "at": "2026-10-10T14:45:00.000Z",
        "updatedAt": "2026-10-10T14:45:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

---

### 3.3. Lấy Chi Tiết Một Tin Nhắn Theo ID (Get Message By ID)
- **Mục đích:** Xem chi tiết một tin nhắn cụ thể.
- **Method & Path:** `GET /api/v1/chat/messages/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Người gửi, chủ cuộc trò chuyện hoặc nhân viên quản lý.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của tin nhắn |

- **Responses:**

#### `200 OK` - Lấy thông tin thành công
```json
{
  "status": "success",
  "data": {
    "message": {
      "id": "e2a1b0c9-8765-4321-fedc-ba9876543210",
      "conversationId": "lucas@example.com",
      "senderId": "e3a7b960-91a5-48b4-a698-32380598b981",
      "senderName": "Lucas Tran",
      "owner": "lucas@example.com",
      "senderRole": "customer",
      "message": "Shop còn bàn phím không ạ?",
      "isRead": false,
      "createdAt": "2026-10-10T14:45:00.000Z"
    }
  }
}
```

#### `403 Forbidden` - Không có quyền xem tin nhắn của người khác
```json
{
  "status": "error",
  "message": "Bạn không có quyền xem tin nhắn này"
}
```

---

### 3.4. Gửi Tin Nhắn Mới (Send Message)
- **Mục đích:** Người dùng gửi thắc mắc hỗ trợ hoặc nhân viên phản hồi lại khách hàng.
- **Method & Path:** `POST /api/v1/chat/messages`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`

#### Khách hàng gửi tin nhắn:
```json
{
  "message": "Xin chào shop, sản phẩm này còn màu trắng và có sẵn hàng tại chi nhánh HCM không ạ?",
  "conversation_id": "lucas@example.com"
}
```

#### Nhân viên trả lời khách hàng:
```json
{
  "owner": "lucas@example.com",
  "conversation_id": "lucas@example.com",
  "message": "Chào bạn, sản phẩm màu trắng hiện đang có sẵn tại chi nhánh Quận 1 bạn nhé!",
  "sender_role": "shop"
}
```

- **Responses:**

#### `201 Created` - Gửi thành công
```json
{
  "status": "success",
  "message": "Gửi tin nhắn thành công",
  "data": {
    "message": {
      "id": "e2a1b0c9-8765-4321-fedc-ba9876543210",
      "conversationId": "lucas@example.com",
      "senderId": "e3a7b960-91a5-48b4-a698-32380598b981",
      "senderName": "Lucas Tran",
      "owner": "lucas@example.com",
      "senderRole": "customer",
      "from": "customer",
      "message": "Xin chào shop, sản phẩm này còn màu trắng và có sẵn hàng tại chi nhánh HCM không ạ?",
      "text": "Xin chào shop, sản phẩm này còn màu trắng và có sẵn hàng tại chi nhánh HCM không ạ?",
      "isRead": false,
      "createdAt": "2026-10-10T14:50:00.000Z",
      "at": "2026-10-10T14:50:00.000Z",
      "updatedAt": "2026-10-10T14:50:00.000Z"
    }
  }
}
```

#### `400 Bad Request` - Thiếu nội dung
```json
{
  "status": "error",
  "message": "Nội dung tin nhắn không được để trống"
}
```

---

### 3.5. Đánh Dấu Một Tin Nhắn Đã Đọc (Mark Message As Read)
- **Mục đích:** Cập nhật trạng thái `is_read = true` cho một tin nhắn cụ thể khi người nhận mở cửa sổ chat.
- **Method & Path:** `PATCH /api/v1/chat/messages/:id/read`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của tin nhắn |

- **Responses:**

#### `200 OK` - Cập nhật thành công
```json
{
  "status": "success",
  "message": "Đã đánh dấu tin nhắn là đã đọc",
  "data": {
    "message": {
      "id": "e2a1b0c9-8765-4321-fedc-ba9876543210",
      "owner": "lucas@example.com",
      "isRead": true
    }
  }
}
```

---

### 3.6. Đánh Dấu Tất Cả Tin Nhắn Là Đã Đọc (Mark All As Read)
- **Mục đích:** Đánh dấu toàn bộ tin nhắn chưa đọc trong cuộc hội thoại là đã xem.
- **Method & Path:** `PATCH /api/v1/chat/read-all`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Request Body:**
```json
{
  "owner": "lucas@example.com"
}
```
*(Nếu là khách hàng thông thường, server tự động sử dụng email của chính khách hàng đó mà không cần truyền body).*

- **Responses:**

#### `200 OK` - Cập nhật thành công
```json
{
  "status": "success",
  "message": "Đã đánh dấu 3 tin nhắn là đã đọc",
  "data": {
    "updatedCount": 3
  }
}
```

---

### 3.7. Xóa Một Tin Nhắn (Delete Message)
- **Mục đích:** Xóa bỏ một tin nhắn cụ thể (chỉ người gửi tin nhắn đó hoặc nhân viên quản trị).
- **Method & Path:** `DELETE /api/v1/chat/messages/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`).
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của tin nhắn cần xóa |

- **Responses:**

#### `200 OK` - Xóa thành công
```json
{
  "status": "success",
  "message": "Xóa tin nhắn thành công"
}
```

#### `403 Forbidden` - Xóa tin nhắn của người khác
```json
{
  "status": "error",
  "message": "Bạn không có quyền xóa tin nhắn này"
}
```

---

### 3.8. Xóa Toàn Bộ Cuộc Hội Thoại (Delete Conversation)
- **Mục đích:** Khách hàng hoặc Admin xóa sạch lịch sử hội thoại của một tài khoản.
- **Method & Path:** `DELETE /api/v1/chat/conversations/:owner`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Chủ tài khoản hoặc Admin/Manager.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `owner` | `string` | Có | Email chủ cuộc trò chuyện cần xóa |

- **Responses:**

#### `200 OK` - Xóa thành công
```json
{
  "status": "success",
  "message": "Đã xóa hội thoại với 12 tin nhắn",
  "data": {
    "deletedCount": 12
  }
}
```
