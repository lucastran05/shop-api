# 16. HỘI THOẠI QUẢN TRỊ (ADMIN CHAT)
> **Mã phân hệ:** `ADM`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý hộp thư chăm sóc khách hàng, trả lời tin nhắn tư vấn và theo dõi các luồng hội thoại của khách:
- **Quy tắc nghiệp vụ:**
  - Danh sách hội thoại (`ADM01`) trả về kèm thông tin định danh khách hàng (`customer: { id, name, email }`) và tin nhắn mới nhất.
  - Hỗ trợ tìm kiếm hội thoại theo tên khách hàng hoặc email.
  - Phản hồi từ shop (`ADM03`): Đánh dấu `sender_role = "staff"`, ghi nhận `sender: { id, name }` là nhân viên/quản trị viên đang trực tiếp trả lời.
  - Giới hạn nội dung tin nhắn phản hồi của shop tối đa 2000 ký tự.

---

## 2. Thông tin chung

- **Base URL:** `/admin/conversations`
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **ADM01** | `GET` | `/admin/conversations` | Manager / Admin | Danh sách hội thoại, tìm khách theo tên hoặc email |
| **ADM02** | `GET` | `/admin/conversations/:id/messages` | Manager / Admin | Nạp lịch sử tin nhắn của một khách hàng cụ thể |
| **ADM03** | `POST` | `/admin/conversations/:id/messages` | Manager / Admin | Nhân viên/Shop gửi tin nhắn phản hồi cho khách |

---

## 4. Chi tiết từng Endpoint

### 4.1. ADM01 — Danh sách hội thoại
- **Method:** `GET`
- **Path:** `/admin/conversations`
- **Query Parameters:** `keyword=nguyenvana&page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "conv-9911",
      "customer": {
        "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
        "name": "Nguyễn Văn A",
        "email": "nguyenvana@example.com"
      },
      "last_message": {
        "id": "msg-003",
        "content": "Cảm ơn shop nhiều nhé!",
        "sender_role": "customer",
        "created_at": "2026-10-13T09:17:00.000Z"
      },
      "updated_at": "2026-10-13T09:17:00.000Z"
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

### 4.2. ADM03 — Gửi tin phản hồi cho khách
- **Method:** `POST`
- **Path:** `/admin/conversations/:conversation_id/messages`

#### Request Body
```json
{
  "content": "Dạ không có gì ạ! Chúc bạn có trải nghiệm tuyệt vời cùng sản phẩm!",
  "client_message_id": "reply-uuid-9900"
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "data": {
    "id": "msg-004",
    "conversation_id": "conv-9911",
    "content": "Dạ không có gì ạ! Chúc bạn có trải nghiệm tuyệt vời cùng sản phẩm!",
    "sender_role": "staff",
    "sender": {
      "id": "admin-01",
      "name": "Quản Trị Viên Chăm Sóc Khách Hàng"
    },
    "client_message_id": "reply-uuid-9900",
    "created_at": "2026-10-13T09:20:00.000Z"
  },
  "customer": {
    "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
    "name": "Nguyễn Văn A",
    "email": "nguyenvana@example.com"
  }
}
```
