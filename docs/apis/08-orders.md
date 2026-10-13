# 08. QUẢN LÝ ĐƠN HÀNG CỦA KHÁCH (CUSTOMER ORDERS)
> **Mã phân hệ:** `ORD`  
> **Phạm vi:** Khách hàng đăng nhập  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Cho phép khách hàng theo dõi lịch sử đơn hàng, xem timeline trạng thái vận chuyển và thực hiện hủy đơn khi đủ điều kiện:
- **Quy tắc nghiệp vụ:**
  - Khách hàng chỉ có quyền xem và thao tác trên đơn hàng do chính mình tạo ra.
  - Phản hồi luôn kèm theo danh sách thao tác được phép (`allowed_actions`, ví dụ: `["cancel", "pay"]`). Frontend căn cứ vào đây để bật/tắt nút hành động.
  - Lịch sử tiến trình (`history`): Lưu lại nhật ký thay đổi trạng thái kèm thời gian và mô tả.
  - Hủy đơn (`ORD03`): Chỉ cho phép hủy khi đơn ở trạng thái chờ xác nhận hoặc chưa được vận chuyển. Nếu đơn đã phát sinh số tiền thanh toán, tiền sẽ được đưa vào quy trình hoàn tiền.

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/orders`
- **Quyền hạn truy cập:** Khách hàng đã đăng nhập (`Customer`).
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **ORD01** | `GET` | `/api/v1/orders` | Customer | Lấy danh sách đơn hàng của khách kèm bộ lọc trạng thái |
| **ORD02** | `GET` | `/api/v1/orders/:order_id` | Customer | Xem chi tiết đơn hàng, thông tin vận chuyển và lịch sử tiến trình |
| **ORD03** | `POST` | `/api/v1/orders/:order_id/cancel` | Customer | Yêu cầu hủy đơn hàng |

---

## 4. Chi tiết từng Endpoint

### 4.1. ORD01 — Danh sách đơn hàng
- **Method:** `GET`
- **Path:** `/api/v1/orders`
- **Query Parameters:** `status=pending&page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "ord-771122",
      "code": "ORD-20261013-001",
      "status": "pending",
      "status_label": "Chờ xác nhận",
      "payment_status": "partially_paid",
      "deposit_status": "paid",
      "deposit_paid_at": "2026-10-13T09:35:12.000Z",
      "total_amount": 3310000,
      "deposit_amount": 993000,
      "paid_amount": 993000,
      "refunded_amount": 0,
      "held_amount": 0,
      "remaining_amount": 2317000,
      "item_count": 2,
      "items_preview": [
        {
          "product_name": "Bàn phím cơ không dây AKKO 3084B Plus",
          "variant_label": "CS Jelly Pink Switch",
          "image_url": "https://images.unsplash.com/photo-example-1.jpg",
          "quantity": 2
        }
      ],
      "allowed_actions": ["cancel"],
      "created_at": "2026-10-13T09:31:00.000Z",
      "updated_at": "2026-10-13T09:35:12.000Z"
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

### 4.2. ORD02 — Chi tiết đơn hàng
- **Method:** `GET`
- **Path:** `/api/v1/orders/:order_id`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "ord-771122",
    "code": "ORD-20261013-001",
    "status": "processing",
    "status_label": "Đang chuẩn bị hàng",
    "payment_status": "partially_paid",
    "deposit_status": "paid",
    "deposit_paid_at": "2026-10-13T09:35:12.000Z",
    "payment_method": "vietqr",
    "payment_mode": "deposit",
    "delivery_method": "standard",
    "subtotal": 3380000,
    "shipping_fee": 30000,
    "discount_amount": 100000,
    "total_amount": 3310000,
    "deposit_rate": 0.3,
    "deposit_amount": 993000,
    "amount_due_now": 0,
    "paid_amount": 993000,
    "refunded_amount": 0,
    "held_amount": 0,
    "remaining_amount": 2317000,
    "currency": "VND",
    "recipient": {
      "name": "Nguyễn Văn A",
      "phone": "0987654321",
      "full_address": "Số 123 đường Hồng Hà, Phường Phúc Xá, Hà Nội",
      "note": "Giao giờ hành chính giúp tôi"
    },
    "items": [
      {
        "product_id": "550e8400-e29b-41d4-a716-446655440000",
        "variant_id": "var-01",
        "product_name": "Bàn phím cơ không dây AKKO 3084B Plus",
        "variant_label": "CS Jelly Pink Switch",
        "color": "Hồng / Trắng",
        "image_url": "https://images.unsplash.com/photo-example-1.jpg",
        "unit_price": 1690000,
        "quantity": 2,
        "line_total": 3380000
      }
    ],
    "shipment": {
      "carrier": "Giao Hàng Nhanh",
      "tracking_number": "GHN99887766",
      "shipped_at": null,
      "delivered_at": null
    },
    "history": [
      {
        "id": "h-1",
        "status": "pending",
        "label": "Đơn hàng đã được tạo",
        "note": "Khách đặt cọc thành công",
        "created_at": "2026-10-13T09:31:00.000Z"
      },
      {
        "id": "h-2",
        "status": "processing",
        "label": "Đang chuẩn bị hàng",
        "note": "Kho đang đóng gói sản phẩm",
        "created_at": "2026-10-13T09:50:00.000Z"
      }
    ],
    "allowed_actions": [],
    "created_at": "2026-10-13T09:31:00.000Z",
    "updated_at": "2026-10-13T09:50:00.000Z"
  }
}
```

---

### 4.3. ORD03 — Hủy đơn hàng
- **Method:** `POST`
- **Path:** `/api/v1/orders/:order_id/cancel`

#### Request Body
```json
{
  "reason": "Tôi đặt nhầm màu sản phẩm"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Hủy đơn hàng thành công",
  "data": {
    "id": "ord-771122",
    "code": "ORD-20261013-001",
    "status": "cancelled",
    "status_label": "Đã hủy",
    "refunded_amount": 993000,
    "remaining_amount": 0,
    "allowed_actions": []
  }
}
```
- **`400 Bad Request`**: Đơn hàng đã giao hoặc không được phép hủy.
```json
{
  "status": "error",
  "message": "Đơn hàng đang giao, không thể hủy",
  "code": "ORDER_CANNOT_BE_CANCELLED"
}
```
