# 11. QUẢN TRỊ SẢN PHẨM VÀ BIẾN THỂ (ADMIN PRODUCTS)
> **Mã phân hệ:** `ADP`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý toàn bộ vòng đời sản phẩm: thêm mới, cập nhật danh sách biến thể, điều chỉnh giá, ghim nổi bật, kích hoạt/ẩn sản phẩm và xóa sản phẩm:
- **Quy tắc nghiệp vụ:**
  - Quyền hạn: Bắt buộc xác thực vai trò tối thiểu là `manager` hoặc `admin`.
  - Hỗ trợ lưu trữ sản phẩm cùng **danh sách biến thể (`variants`)** trong một payload duy nhất.
  - Khi cập nhật biến thể cũ, giữ nguyên `id` của biến thể.
  - Khi xóa sản phẩm (`ADP05` hoặc `ADP06`), nếu sản phẩm đã phát sinh đơn hàng, hệ thống bảo toàn dữ liệu lịch sử của đơn hàng và ghi nhận danh sách thất bại ở mảng `failed[]`.

---

## 2. Thông tin chung

- **Base URL:** `/admin/products` (hoặc `/api/v1/admin/products`)
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **ADP01** | `GET` | `/admin/products` | Manager / Admin | Danh sách sản phẩm quản trị kèm bộ lọc trạng thái và ghim |
| **ADP02** | `GET` | `/admin/products/:id` | Manager / Admin | Lấy chi tiết toàn bộ dữ liệu sản phẩm để hiển thị lên form sửa |
| **ADP03** | `POST` | `/admin/products` | Manager / Admin | Thêm mới sản phẩm cùng danh sách biến thể |
| **ADP04** | `PATCH` | `/admin/products/:id` | Manager / Admin | Cập nhật thông tin, ghim, ẩn/hiện hoặc sửa biến thể |
| **ADP05** | `DELETE` | `/admin/products/:id` | Manager / Admin | Xóa một sản phẩm cụ thể |
| **ADP06** | `POST` | `/admin/products/bulk-delete` | Manager / Admin | Xóa hàng loạt nhiều sản phẩm đã chọn |
| **ADP07** | `POST` | `/admin/uploads` | Manager / Admin | Tải ảnh sản phẩm lên server |

---

## 4. Chi tiết từng Endpoint

### 4.1. ADP01 — Danh sách sản phẩm quản trị
- **Method:** `GET`
- **Path:** `/admin/products`
- **Query Parameters:** `keyword=bàn phím&is_active=true&page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Bàn phím cơ không dây AKKO 3084B Plus",
      "image_url": "https://example.com/photo.jpg",
      "category": { "id": "cat-01", "name": "Bàn phím cơ" },
      "price_from": 1690000,
      "stock_quantity": 25,
      "is_pinned": true,
      "is_active": true
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

### 4.2. ADP03 — Tạo sản phẩm mới kèm biến thể
- **Method:** `POST`
- **Path:** `/admin/products`

#### Request Body
```json
{
  "name": "Chuột Gaming Không Dây Siêu Nhẹ ABC-X1",
  "category_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "description": "Chuột không dây cảm biến Pixart 3395, trọng lượng chỉ 49 gram.",
  "image_ids": ["up-01", "up-02"],
  "is_active": true,
  "is_pinned": false,
  "allow_deposit": false,
  "deposit_rate": 0,
  "variants": [
    {
      "label": "Màu Trắng Tuyết",
      "color": "Trắng",
      "price": 890000,
      "old_price": 990000,
      "stock_quantity": 50
    },
    {
      "label": "Màu Đen Nhám",
      "color": "Đen",
      "price": 890000,
      "old_price": 990000,
      "stock_quantity": 30
    }
  ]
}
```

#### Responses Mẫu
- **`201 Created`**: Trả về dữ liệu sản phẩm vừa tạo kèm ID và danh sách biến thể.

---

### 4.3. ADP06 — Xóa nhiều sản phẩm
- **Method:** `POST`
- **Path:** `/admin/products/bulk-delete`

#### Request Body
```json
{
  "ids": ["550e8400-e29b-41d4-a716-446655440000", "non-existent-id"]
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "deleted_ids": ["550e8400-e29b-41d4-a716-446655440000"],
    "failed": [
      {
        "id": "non-existent-id",
        "code": "NOT_FOUND",
        "message": "Không tìm thấy sản phẩm"
      }
    ]
  }
}
```
