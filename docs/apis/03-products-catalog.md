# 03. DANH MỤC VÀ TÌM KIẾM SẢN PHẨM (PRODUCTS CATALOG)
> **Mã phân hệ:** `CAT`  
> **Phạm vi:** Khách hàng, Khách vãng lai  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Cung cấp danh mục sản phẩm, bộ lọc, tìm kiếm theo từ khóa và trang chi tiết sản phẩm cho khách mua hàng:
- **Quy tắc nghiệp vụ:**
  - Chỉ hiển thị các sản phẩm đang được kích hoạt (`is_active = true`).
  - Sản phẩm được ghim (`is_pinned = true`) sẽ được ưu tiên hiển thị lên đầu danh sách hiển thị mặc định.
  - Hỗ trợ biến thể sản phẩm (`variants`): Mỗi sản phẩm có thể có nhiều biến thể theo màu sắc, kích thước, giá và tồn kho riêng biệt.
  - Thông tin đặt cọc: Cho biết sản phẩm có cho phép đặt cọc trước hay không (`allow_deposit`) và tỷ lệ cọc tối thiểu (`deposit_rate`, ví dụ: `0.3` tương ứng 30%).

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/products` và `/api/v1/categories`
- **Quyền hạn truy cập:** Toàn bộ công khai (`Public`).

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **CAT01** | `GET` | `/api/v1/products` | Public | Danh sách sản phẩm, tìm kiếm, lọc theo giá, danh mục và phân trang |
| **CAT02** | `GET` | `/api/v1/products/:product_id` | Public | Chi tiết sản phẩm, danh sách biến thể, thông số kỹ thuật và ảnh |
| **CAT03** | `GET` | `/api/v1/categories` | Public | Danh sách danh mục sản phẩm kèm số lượng sản phẩm của từng nhóm |

---

## 4. Chi tiết từng Endpoint

### 4.1. CAT01 — Danh sách sản phẩm và bộ lọc
- **Method:** `GET`
- **Path:** `/api/v1/products`
- **Query Parameters:**
  - `keyword` (string): Từ khóa tìm kiếm theo tên hoặc mô tả.
  - `category_id` (UUID): Lọc theo danh mục.
  - `min_price`, `max_price` (number): Lọc theo khoảng giá (VND).
  - `in_stock` (boolean): `true` chỉ lấy hàng còn tồn trong kho.
  - `sold_by_stem` (boolean): `true` chỉ lấy hoa bán lẻ theo cành (dùng cho trang Tự tạo bó hoa); mỗi dòng trả thêm `sold_by_stem`. Chi tiết sản phẩm (`CAT02`) trả thêm `stem_head_size` — cỡ bông so với hoa hồng tính theo phần trăm (30–300, mặc định 100), chỉ dùng để vẽ bó xem trước.
  - `is_pinned` (boolean): `true` chỉ lấy hàng được ghim.
  - `sort` (string): `price_asc`, `price_desc`, `newest`, `popular`.
  - `page` (number): Mặc định `1`.
  - `limit` (number): Mặc định `12`.

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Bàn phím cơ không dây AKKO 3084B Plus",
      "image_url": "https://images.unsplash.com/photo-example-1.jpg",
      "category": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "Bàn phím cơ"
      },
      "price": 1690000,
      "old_price": 1890000,
      "stock_quantity": 25,
      "is_pinned": true
    }
  ],
  "filters": {
    "min_price": 500000,
    "max_price": 5000000
  },
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 48,
    "total_pages": 4
  }
}
```

#### Lệnh cURL
```bash
curl -X GET "http://localhost:5000/api/v1/products?keyword=akko&sort=price_asc&page=1&limit=10"
```

---

### 4.2. CAT02 — Chi tiết sản phẩm và chọn biến thể
- **Method:** `GET`
- **Path:** `/api/v1/products/:product_id`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Bàn phím cơ không dây AKKO 3084B Plus",
    "description": "Bàn phím cơ 3 chế độ kết nối (Bluetooth 5.0, 2.4GHz và Type-C), Keycap PBT Double-Shot bền bỉ.",
    "category": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Bàn phím cơ"
    },
    "images": [
      {
        "id": "img-01",
        "url": "https://images.unsplash.com/photo-example-1.jpg",
        "alt_text": "Mặt trước bàn phím",
        "sort_order": 1
      }
    ],
    "variants": [
      {
        "id": "var-01",
        "label": "CS Jelly Pink Switch",
        "color": "Hồng / Trắng",
        "price": 1690000,
        "old_price": 1890000,
        "stock_quantity": 15
      },
      {
        "id": "var-02",
        "label": "CS Jelly Purple Switch",
        "color": "Tím / Trắng",
        "price": 1750000,
        "old_price": 1950000,
        "stock_quantity": 10
      }
    ],
    "attributes": [
      { "label": "Kết nối", "value": "Wireless 2.4Ghz / Bluetooth 5.0 / Type-C" },
      { "label": "Layout", "value": "84 Phím" },
      { "label": "Dung lượng pin", "value": "3000 mAh" }
    ],
    "price": 1690000,
    "old_price": 1890000,
    "stock_quantity": 25,
    "is_pinned": true,
    "allow_deposit": true,
    "deposit_rate": 0.3,
    "created_at": "2026-10-10T08:00:00.000Z",
    "updated_at": "2026-10-12T14:30:00.000Z"
  }
}
```

---

### 4.3. CAT03 — Danh sách danh mục sản phẩm
- **Method:** `GET`
- **Path:** `/api/v1/categories`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Bàn phím cơ",
      "product_count": 28
    },
    {
      "id": "7ca12f89-8901-4bcd-88ef-123456789abc",
      "name": "Chuột Gaming",
      "product_count": 14
    }
  ]
}
```

#### Lệnh cURL
```bash
curl -X GET "http://localhost:5000/api/v1/categories"
```
