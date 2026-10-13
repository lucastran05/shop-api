# 09. CHAT VÀ THÔNG BÁO (CHAT & NOTIFICATIONS)
> **Mã phân hệ:** `CHAT` / `NOT`  
> **Phạm vi:** Khách hàng đăng nhập  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Cung cấp tính năng trò chuyện trực tiếp giữa khách hàng và bộ phận chăm sóc khách hàng của cửa hàng, cùng hệ thống nhận thông báo đơn hàng và khuyến mãi:
- **Quy tắc nghiệp vụ:**
  - Khách hàng đăng nhập có 1 luồng hội thoại duy nhất với Shop.
  - Lấy tin nhắn mới: Có thể dùng `after_id` hoặc `cursor` để lấy các tin mới nhất sau ID gần nhất.
  - Phân định người gửi: `sender_role` là `customer` hoặc `staff` / `admin`.
  - Thông báo: Lưu trữ thông báo cá nhân (cập nhật đơn hàng, thanh toán) và thông báo chung. Có bộ đếm `unread_count` theo thời gian thực.
  - Hỗ trợ đánh dấu đọc từng thông báo hoặc đọc tất cả thông báo trong 1 thao tác.

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/conversations` và `/api/v1/notifications`
- **Quyền hạn truy cập:** Khách hàng đã đăng nhập (`Customer`).
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **CHAT01** | `POST` | `/api/v1/conversations` | Customer | Khởi tạo hoặc lấy hội thoại hiện có giữa khách và shop |
| **CHAT02** | `GET` | `/api/v1/conversations/:id/messages` | Customer | Nạp lịch sử tin nhắn trong hội thoại |
| **CHAT03** | `POST` | `/api/v1/conversations/:id/messages` | Customer | Gửi tin nhắn mới cho Shop |
| **NOT01** | `GET` | `/api/v1/notifications` | Customer | Danh sách thông báo và số lượng chưa đọc |
| **NOT02** | `PATCH` | `/api/v1/notifications/:id/read` | Customer | Đánh dấu một thông báo đã đọc |
| **NOT03** | `POST` | `/api/v1/notifications/read-all` | Customer | Đánh dấu tất cả thông báo đã đọc |

---

## 4. Chi tiết từng Endpoint

### 4.1. CHAT01 — Mở hội thoại với shop
- **Method:** `POST`
- **Path:** `/api/v1/conversations`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "conv-9911",
    "customer": {
      "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@example.com"
    },
    "last_message": {
      "id": "msg-001",
      "content": "Chào shop, mình muốn hỏi về switch bàn phím",
      "sender_role": "customer",
      "created_at": "2026-10-13T09:15:00.000Z"
    },
    "created_at": "2026-10-10T12:00:00.000Z"
  }
}
```

---

### 4.2. CHAT02 — Lấy tin nhắn trong hội thoại
- **Method:** `GET`
- **Path:** `/api/v1/conversations/:id/messages`
- **Query Parameters:** `limit=20&after_id=msg-001`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "msg-002",
      "conversation_id": "conv-9911",
      "content": "Dạ chào bạn, switch CS Jelly Pink gõ rất êm và có lube sẵn từ nhà máy ạ!",
      "sender_role": "staff",
      "sender": {
        "id": "staff-01",
        "name": "Chăm Sóc Khách Hàng ABC"
      },
      "created_at": "2026-10-13T09:16:10.000Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false
  }
}
```

---

### 4.3. CHAT03 — Gửi tin nhắn mới
- **Method:** `POST`
- **Path:** `/api/v1/conversations/:id/messages`

#### Request Body
```json
{
  "content": "Cảm ơn shop nhiều nhé!",
  "client_message_id": "temp-uuid-1234"
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "data": {
    "id": "msg-003",
    "conversation_id": "conv-9911",
    "content": "Cảm ơn shop nhiều nhé!",
    "sender_role": "customer",
    "sender": {
      "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
      "name": "Nguyễn Văn A"
    },
    "client_message_id": "temp-uuid-1234",
    "created_at": "2026-10-13T09:17:00.000Z"
  }
}
```

---

### 4.4. NOT01 — Danh sách thông báo
- **Method:** `GET`
- **Path:** `/api/v1/notifications`
- **Query Parameters:** `page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "notif-01",
      "title": "Đơn hàng đã được xác nhận cọc",
      "content": "Đơn hàng ORD-20261013-001 của bạn đã ghi nhận tiền đặt cọc 993,000 VND thành công.",
      "type": "order",
      "target_type": "order",
      "target_id": "ord-771122",
      "is_read": false,
      "created_at": "2026-10-13T09:35:12.000Z"
    }
  ],
  "unread_count": 1,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 4.5. NOT02 — Đánh dấu một thông báo đã đọc
- **Method:** `PATCH`
- **Path:** `/api/v1/notifications/:id/read`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "notif-01",
    "is_read": true,
    "read_at": "2026-10-13T09:40:00.000Z"
  },
  "unread_count": 0
}
```

---

### 4.6. NOT03 — Đánh dấu tất cả đã đọc
- **Method:** `POST`
- **Path:** `/api/v1/notifications/read-all`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "updated_count": 5,
    "read_at": "2026-10-13T09:40:00.000Z"
  },
  "unread_count": 0
}
```
