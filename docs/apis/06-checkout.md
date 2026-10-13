# 06. BÁO GIÁ VÀ TẠO ĐƠN HÀNG (CHECKOUT)
> **Mã phân hệ:** `CHK`  
> **Phạm vi:** Khách hàng đăng nhập  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Tính toán chi tiết chi phí đặt hàng (báo giá), áp dụng mã giảm giá, tính phí vận chuyển và chốt tạo đơn hàng:
- **Quy tắc nghiệp vụ:**
  - Quy trình Checkout chia làm 2 bước chặt chẽ:
    1. **Báo giá (`CHK01`)**: Backend kiểm tra tồn kho, tính lại đơn giá thực tế, phí ship theo địa chỉ, trừ mã giảm giá (nếu hợp lệ), và sinh ra `quote_id` có thời hạn (`expires_at`, thường 15 phút).
    2. **Tạo đơn (`CHK02`)**: Sử dụng `quote_id` để tạo đơn. Nếu hàng hóa hết hạn báo giá hoặc thay đổi giá/tồn kho, khách hàng phải lấy báo giá mới.
  - Hỗ trợ cả **đặt hàng từ giỏ** (`cart_item_ids`) lẫn **mua ngay** trực tiếp từ trang chi tiết sản phẩm (`items[]`).
  - Hỗ trợ hai chế độ thanh toán: trả đủ (`full`) hoặc đặt cọc trước (`deposit`).
  - Sử dụng Header `Idempotency-Key` khi tạo đơn để chống tạo trùng lặp đơn hàng khi mạng bị trễ hoặc người dùng bấm nhiều lần.
  - Tự động xóa các dòng sản phẩm đã đặt mua thành công khỏi giỏ hàng (`removed_cart_item_ids`).

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/checkout` và `/api/v1/orders`
- **Quyền hạn truy cập:** Khách hàng đã đăng nhập (`Customer`).
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **CHK01** | `POST` | `/api/v1/checkout/quote` | Customer | Kiểm tra khả năng đặt hàng, tính cước vận chuyển và sinh báo giá |
| **CHK02** | `POST` | `/api/v1/orders` | Customer | Xác nhận đặt hàng từ mã báo giá (quote_id) |

---

## 4. Chi tiết từng Endpoint

### 4.1. CHK01 — Lấy báo giá chi tiết đơn hàng
- **Method:** `POST`
- **Path:** `/api/v1/checkout/quote`

#### Request Body
```json
{
  "cart_item_ids": ["item-01"],
  "address_id": "7b8e5d32-2345-4ef0-911a-1299abf54101",
  "delivery_method": "standard",
  "coupon_code": "SALE10",
  "payment_method": "vietqr",
  "payment_mode": "deposit",
  "deposit_rate": 0.3,
  "note": "Giao giờ hành chính giúp tôi"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "quote_id": "qt_9a8b7c6d5e4f",
    "expires_at": "2026-10-13T09:45:00.000Z",
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
        "line_total": 3380000,
        "stock_quantity": 15,
        "is_available": true
      }
    ],
    "recipient": {
      "name": "Nguyễn Văn A",
      "phone": "0987654321",
      "full_address": "Số 123 đường Hồng Hà, Phường Phúc Xá, Hà Nội"
    },
    "delivery_method": "standard",
    "coupon": {
      "code": "SALE10",
      "discount_amount": 100000
    },
    "allowed_payment_methods": ["vietqr", "momo", "cod"],
    "allowed_deposit_rates": [0.3, 0.5, 1.0],
    "subtotal": 3380000,
    "shipping_fee": 30000,
    "discount_amount": 100000,
    "total_amount": 3310000,
    "deposit_rate": 0.3,
    "deposit_amount": 993000,
    "amount_due_now": 993000,
    "paid_amount": 0,
    "refunded_amount": 0,
    "held_amount": 0,
    "remaining_amount": 2317000,
    "currency": "VND"
  }
}
```

---

### 4.2. CHK02 — Xác nhận tạo đơn hàng từ báo giá
- **Method:** `POST`
- **Path:** `/api/v1/orders`
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: e9a2c340-9a21-4f10-b991-5832a8df5111`

#### Request Body
```json
{
  "quote_id": "qt_9a8b7c6d5e4f",
  "note": "Giao giờ hành chính giúp tôi"
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "message": "Tạo đơn hàng thành công",
  "data": {
    "id": "ord-771122",
    "code": "ORD-20261013-001",
    "status": "pending",
    "status_label": "Chờ thanh toán",
    "payment_status": "unpaid",
    "deposit_status": "unpaid",
    "deposit_paid_at": null,
    "total_amount": 3310000,
    "deposit_amount": 993000,
    "paid_amount": 0,
    "refunded_amount": 0,
    "held_amount": 0,
    "remaining_amount": 3310000,
    "payment_method": "vietqr",
    "payment_mode": "deposit",
    "delivery_method": "standard",
    "amount_due_now": 993000,
    "currency": "VND",
    "removed_cart_item_ids": ["item-01"],
    "created_at": "2026-10-13T09:31:00.000Z",
    "updated_at": "2026-10-13T09:31:00.000Z"
  }
}
```

#### Lệnh cURL
```bash
curl -X POST "http://localhost:5000/api/v1/orders" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Idempotency-Key: uuid-v4-key" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_id": "qt_9a8b7c6d5e4f"
  }'
```
