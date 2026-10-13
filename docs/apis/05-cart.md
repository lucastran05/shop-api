# 05. GIỎ HÀNG (SHOPPING CART)
> **Mã phân hệ:** `CART`  
> **Phạm vi:** Khách hàng đăng nhập  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý giỏ hàng của khách hàng, kiểm tra tính khả dụng của biến thể sản phẩm và tính toán tạm tính:
- **Quy tắc nghiệp vụ:**
  - Định danh sản phẩm trong giỏ kết hợp cả `product_id` và `variant_id`.
  - Khi thêm sản phẩm đã tồn tại trong giỏ với cùng biến thể, hệ thống tự động cộng dồn số lượng.
  - Số lượng trong giỏ không được vượt quá số lượng tồn kho khả dụng (`stock_quantity`).
  - Phản hồi luôn tính sẵn `line_count` (số mặt hàng khác nhau), `item_count` (tổng số lượng sản phẩm), và `subtotal` (tổng tiền toàn bộ giỏ).

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/cart`
- **Quyền hạn truy cập:** Khách hàng đã đăng nhập (`Customer`).
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **CART01** | `GET` | `/api/v1/cart` | Customer | Lấy thông tin giỏ hàng và số lượng badge ở Header |
| **CART02** | `POST` | `/api/v1/cart/items` | Customer | Thêm một biến thể sản phẩm vào giỏ hàng |
| **CART03** | `PATCH` | `/api/v1/cart/items/:item_id` | Customer | Điều chỉnh số lượng sản phẩm trong dòng giỏ hàng |
| **CART04** | `DELETE` | `/api/v1/cart/items/:item_id` | Customer | Xóa một dòng sản phẩm khỏi giỏ hàng |

---

## 4. Chi tiết từng Endpoint

### 4.1. CART01 — Lấy giỏ hàng
- **Method:** `GET`
- **Path:** `/api/v1/cart`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "cart-987123",
    "line_count": 1,
    "item_count": 2,
    "subtotal": 3380000,
    "currency": "VND",
    "updated_at": "2026-10-13T09:10:00.000Z",
    "items": [
      {
        "id": "item-01",
        "product_id": "550e8400-e29b-41d4-a716-446655440000",
        "variant_id": "var-01",
        "product_name": "Bàn phím cơ không dây AKKO 3084B Plus",
        "variant_label": "CS Jelly Pink Switch",
        "color": "Hồng / Trắng",
        "image_url": "https://images.unsplash.com/photo-example-1.jpg",
        "unit_price": 1690000,
        "quantity": 2,
        "stock_quantity": 15,
        "line_total": 3380000,
        "is_available": true
      }
    ]
  }
}
```

---

### 4.2. CART02 — Thêm sản phẩm vào giỏ
- **Method:** `POST`
- **Path:** `/api/v1/cart/items`

#### Request Body
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "variant_id": "var-01",
  "quantity": 1
}
```

#### Responses Mẫu
- **`200 OK`**: Trả về cấu trúc giỏ hàng mới nhất đã cập nhật.
- **`400 Bad Request`**: Số lượng vượt quá tồn kho khả dụng.
```json
{
  "status": "error",
  "message": "Số lượng yêu cầu vượt quá tồn kho khả dụng",
  "code": "INSUFFICIENT_STOCK"
}
```

---

### 4.3. CART03 — Sửa số lượng sản phẩm
- **Method:** `PATCH`
- **Path:** `/api/v1/cart/items/:item_id`

#### Request Body
```json
{
  "quantity": 3
}
```

#### Responses Mẫu
- **`200 OK`**: Trả về dữ liệu giỏ hàng mới nhất.

---

### 4.4. CART04 — Xóa sản phẩm khỏi giỏ
- **Method:** `DELETE`
- **Path:** `/api/v1/cart/items/:item_id`

#### Responses Mẫu
- **`200 OK`**: Trả về dữ liệu giỏ hàng sau khi loại bỏ sản phẩm.

#### Lệnh cURL
```bash
curl -X DELETE "http://localhost:5000/api/v1/cart/items/item-01" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```
