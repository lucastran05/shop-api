# Tài Liệu API Sản Phẩm (Products API)

Tài liệu kỹ thuật chi tiết về các endpoint quản lý danh mục và sản phẩm (Products & Categories), cấu trúc bảng cơ sở dữ liệu PostgreSQL, các bộ lọc tìm kiếm nâng cao và phân quyền cho ứng dụng **Shop API**.

---

## 1. Cấu Trúc Bảng Dữ Liệu `products` (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  old_price DECIMAL(12, 2),
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  variants JSONB DEFAULT '[]'::jsonb,
  attributes JSONB DEFAULT '[]'::jsonb,
  featured BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  deposit BOOLEAN DEFAULT FALSE,
  deposit_rate DECIMAL(5, 2) DEFAULT 20.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Chi tiết các cột:
| Cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | Khóa chính duy nhất dạng UUID v4 |
| `name` | `VARCHAR(255)` | NOT NULL | - | Tên sản phẩm |
| `category` | `VARCHAR(100)` | NOT NULL | - | Tên phân loại / danh mục sản phẩm |
| `description` | `TEXT` | NULL | `""` | Mô tả chi tiết thông số, tính năng sản phẩm |
| `price` | `DECIMAL(12,2)`| NOT NULL | `0` | Giá bán hiện tại (VNĐ) |
| `old_price` | `DECIMAL(12,2)`| NULL | NULL | Giá gốc trước khuyến mãi (VNĐ) |
| `stock` | `INTEGER` | NOT NULL | `0` | Số lượng tồn kho |
| `image` | `TEXT` | NULL | `""` | Ảnh đại diện chính (URL) |
| `images` | `JSONB` | NULL | `'[]'` | Mảng danh sách các hình ảnh chi tiết (URLs) |
| `variants` | `JSONB` | NULL | `'[]'` | Mảng các biến thể (Màu sắc, kích thước, SKU, giá riêng) |
| `attributes` | `JSONB` | NULL | `'[]'` | Mảng thuộc tính kỹ thuật (ví dụ: Bảo hành, Xuất xứ) |
| `featured` | `BOOLEAN` | - | `FALSE` | Đánh dấu sản phẩm nổi bật hiển thị ở trang chủ |
| `active` | `BOOLEAN` | - | `TRUE` | Trạng thái hiển thị (`true`: đang bán, `false`: ẩn) |
| `deposit` | `BOOLEAN` | - | `FALSE` | Hỗ trợ hình thức đặt cọc giữ hàng |
| `deposit_rate`| `DECIMAL(5,2)` | - | `20.00` | Tỷ lệ đặt cọc (%) nếu bật `deposit` |
| `created_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm tạo sản phẩm |
| `updated_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm cập nhật thông tin sản phẩm |

---

## 2. Chi Tiết Các Endpoint Sản Phẩm

### 2.1. Lấy Danh Sách Danh Mục Sản Phẩm (Get Categories)
- **Mục đích:** Lấy toàn bộ danh sách các tên danh mục sản phẩm duy nhất (distinct) đang có trong kho hàng để hiển thị trên menu điều hướng hoặc bộ lọc.
- **Method & Path:** `GET /api/v1/products/categories`
- **Authentication/Authorization:** Không yêu cầu (Public).
- **Headers:**
  - `Accept: application/json`
- **Parameters:** Không có.
- **Request Body:** Không có.
- **Responses:**

#### `200 OK` - Lấy danh mục thành công
```json
{
  "status": "success",
  "data": {
    "categories": [
      "Bàn phím cơ",
      "Chuột gaming",
      "Linh kiện máy tính",
      "Màn hình",
      "Phụ kiện",
      "Tai nghe",
      "Âm thanh"
    ]
  }
}
```

---

### 2.2. Lấy Danh Sách Sản Phẩm (Get All Products)
- **Mục đích:** Lấy danh sách sản phẩm có phân trang, tìm kiếm theo tên hoặc mô tả, lọc theo danh mục, khoảng giá, trạng thái và sắp xếp theo nhiều tiêu chí.
- **Method & Path:** `GET /api/v1/products`
- **Authentication/Authorization:** Không yêu cầu (Public).
- **Headers:**
  - `Accept: application/json`
- **Query Parameters:**
  | Tên | Kiểu | Bắt buộc | Mặc định | Mô tả |
  | :--- | :--- | :--- | :--- | :--- |
  | `page` | `integer` | Không | `1` | Số trang cần xem |
  | `limit` | `integer` | Không | `20` | Số lượng sản phẩm mỗi trang |
  | `search` | `string` | Không | `""` | Từ khóa tìm kiếm (so khớp không phân biệt hoa thường trong `name` và `description`) |
  | `category` | `string` | Không | `""` | Lọc chính xác theo tên danh mục |
  | `featured` | `boolean` | Không | - | `true`: chỉ lấy sản phẩm nổi bật; `false`: sản phẩm thường |
  | `active` | `boolean` | Không | - | `true`: chỉ lấy sản phẩm đang kinh doanh |
  | `minPrice` | `number` | Không | - | Mức giá thấp nhất (VNĐ) |
  | `maxPrice` | `number` | Không | - | Mức giá cao nhất (VNĐ) |
  | `sort` | `string` | Không | `'newest'` | Tiêu chí sắp xếp: `newest` (mới nhất), `oldest` (cũ nhất), `price_asc` (giá tăng dần), `price_desc` (giá giảm dần), `name_asc` (A-Z), `name_desc` (Z-A) |

- **Request Body:** Không có.
- **Responses:**

#### `200 OK` - Lấy danh sách sản phẩm thành công
```json
{
  "status": "success",
  "data": {
    "products": [
      {
        "id": "b3e34bcf-697b-402a-a9a3-55913e7ce001",
        "name": "Bàn Phím Cơ Không Dây RGB Pro",
        "category": "Bàn phím cơ",
        "description": "Bàn phím cơ bluetooth 3 mode kết nối, switch hotswap 5 pin, keycap PBT doubleshot.",
        "price": "1250000.00",
        "oldPrice": "1500000.00",
        "stock": 45,
        "image": "https://images.unsplash.com/photo-1587829741301-dc798b83add3",
        "images": [
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3",
          "https://images.unsplash.com/photo-1595225476474-87563907a212"
        ],
        "variants": [
          { "switch": "Red Switch", "color": "Trắng Xám", "price": 1250000 },
          { "switch": "Brown Switch", "color": "Đen Nhám", "price": 1250000 }
        ],
        "attributes": [
          { "name": "Bảo hành", "value": "24 tháng chính hãng" },
          { "name": "Kết nối", "value": "Type-C, 2.4Ghz, Bluetooth 5.0" }
        ],
        "featured": true,
        "active": true,
        "deposit": false,
        "depositRate": "20.00",
        "createdAt": "2026-10-10T12:00:00.000Z",
        "updatedAt": "2026-10-10T12:00:00.000Z"
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

### 2.3. Lấy Chi Tiết Sản Phẩm Theo ID (Get Product By ID)
- **Mục đích:** Xem chi tiết đầy đủ thông tin, thông số kỹ thuật, biến thể và hình ảnh của một sản phẩm cụ thể.
- **Method & Path:** `GET /api/v1/products/:id`
- **Authentication/Authorization:** Không yêu cầu (Public).
- **Headers:**
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Mã UUID v4 định danh sản phẩm |

- **Request Body:** Không có.
- **Responses:**

#### `200 OK` - Lấy thông tin thành công
```json
{
  "status": "success",
  "data": {
    "product": {
      "id": "b3e34bcf-697b-402a-a9a3-55913e7ce001",
      "name": "Bàn Phím Cơ Không Dây RGB Pro",
      "category": "Bàn phím cơ",
      "description": "Bàn phím cơ bluetooth 3 mode kết nối, switch hotswap 5 pin...",
      "price": "1250000.00",
      "oldPrice": "1500000.00",
      "stock": 45,
      "image": "https://images.unsplash.com/photo-1587829741301-dc798b83add3",
      "images": ["https://images.unsplash.com/photo-1587829741301-dc798b83add3"],
      "variants": [
        { "switch": "Red Switch", "color": "Trắng Xám", "price": 1250000 }
      ],
      "attributes": [
        { "name": "Bảo hành", "value": "24 tháng chính hãng" }
      ],
      "featured": true,
      "active": true,
      "deposit": false,
      "depositRate": "20.00",
      "createdAt": "2026-10-10T12:00:00.000Z",
      "updatedAt": "2026-10-10T12:00:00.000Z"
    }
  }
}
```

#### `404 Not Found` - Không tìm thấy sản phẩm
```json
{
  "status": "error",
  "message": "Không tìm thấy sản phẩm"
}
```

---

### 2.4. Thêm Sản Phẩm Mới (Create Product)
- **Mục đích:** Quản trị viên hoặc Quản lý kho hàng nhập sản phẩm mới vào danh mục sản phẩm của shop.
- **Method & Path:** `POST /api/v1/products`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Parameters:** Không có.
- **Request Body:**

```json
{
  "name": "Tai Nghe Chống Ồn Wireless Pro X",
  "category": "Âm thanh",
  "description": "Tai nghe over-ear cao cấp tích hợp chống ồn chủ động ANC thế hệ mới, pin lên đến 40 giờ.",
  "price": 2500000,
  "oldPrice": 3200000,
  "stock": 50,
  "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
  "images": [
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    "https://images.unsplash.com/photo-1484704849700-f032a568e944"
  ],
  "variants": [
    { "color": "Midnight Black", "sku": "ANC-BLK-01", "price": 2500000 },
    { "color": "Silver White", "sku": "ANC-SLV-02", "price": 2600000 }
  ],
  "attributes": [
    { "name": "Chuẩn kết nối", "value": "Bluetooth 5.3" },
    { "name": "Bảo hành", "value": "24 tháng chính hãng" }
  ],
  "featured": true,
  "active": true,
  "deposit": true,
  "depositRate": 25
}
```

*Chú thích các trường quan trọng:*
- `name` *(string, bắt buộc)*: Tên sản phẩm.
- `category` *(string, bắt buộc)*: Tên danh mục.
- `price` *(number, bắt buộc)*: Giá bán thực tế (lớn hơn hoặc bằng 0).
- `oldPrice` *(number, tùy chọn)*: Giá niêm yết cũ để tạo mức giảm giá.
- `stock` *(number, tùy chọn)*: Số lượng hàng có sẵn (mặc định 0).
- `variants` *(array of objects, tùy chọn)*: Danh sách phiên bản màu, kích cỡ,...
- `deposit` *(boolean, tùy chọn)*: Đánh dấu có yêu cầu đặt cọc trước hay không.
- `depositRate` *(number, tùy chọn)*: Tỷ lệ đặt cọc tính theo phần trăm (ví dụ: 25 nghĩa là 25%).

- **Responses:**

#### `201 Created` - Tạo sản phẩm thành công
```json
{
  "status": "success",
  "message": "Tạo sản phẩm mới thành công",
  "data": {
    "product": {
      "id": "e8d1a2f3-0000-4000-8000-0123456789ab",
      "name": "Tai Nghe Chống Ồn Wireless Pro X",
      "category": "Âm thanh",
      "description": "Tai nghe over-ear cao cấp tích hợp chống ồn chủ động ANC thế hệ mới...",
      "price": "2500000.00",
      "oldPrice": "3200000.00",
      "stock": 50,
      "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
      "images": [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
        "https://images.unsplash.com/photo-1484704849700-f032a568e944"
      ],
      "variants": [
        { "color": "Midnight Black", "sku": "ANC-BLK-01", "price": 2500000 },
        { "color": "Silver White", "sku": "ANC-SLV-02", "price": 2600000 }
      ],
      "attributes": [
        { "name": "Chuẩn kết nối", "value": "Bluetooth 5.3" },
        { "name": "Bảo hành", "value": "24 tháng chính hãng" }
      ],
      "featured": true,
      "active": true,
      "deposit": true,
      "depositRate": "25.00",
      "createdAt": "2026-10-10T14:30:00.000Z",
      "updatedAt": "2026-10-10T14:30:00.000Z"
    }
  }
}
```

#### `400 Bad Request` - Dữ liệu không hợp lệ
```json
{
  "status": "error",
  "message": "Tên sản phẩm không được để trống"
}
```
*Hoặc:*
```json
{
  "status": "error",
  "message": "Danh mục sản phẩm không được để trống"
}
```

#### `401 Unauthorized` - Chưa cung cấp Token
```json
{
  "status": "error",
  "message": "Không tìm thấy token xác thực trong tiêu đề (Authorization header)"
}
```

#### `403 Forbidden` - Không đủ quyền hạn
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin, manager)"
}
```

---

### 2.5. Cập Nhật Sản Phẩm (Update Product)
- **Mục đích:** Chỉnh sửa thông tin, điều chỉnh giá, thay đổi số lượng tồn kho hoặc trạng thái hiển thị của sản phẩm.
- **Method & Path:** `PUT /api/v1/products/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của sản phẩm cần cập nhật |

- **Request Body:**

```json
{
  "price": 2390000,
  "stock": 42,
  "featured": true,
  "deposit": true,
  "depositRate": 30
}
```

- **Responses:**

#### `200 OK` - Cập nhật thành công
```json
{
  "status": "success",
  "message": "Cập nhật sản phẩm thành công",
  "data": {
    "product": {
      "id": "e8d1a2f3-0000-4000-8000-0123456789ab",
      "name": "Tai Nghe Chống Ồn Wireless Pro X",
      "category": "Âm thanh",
      "price": "2390000.00",
      "stock": 42,
      "featured": true,
      "deposit": true,
      "depositRate": "30.00",
      "updatedAt": "2026-10-10T14:45:00.000Z"
    }
  }
}
```

#### `404 Not Found` - Không tìm thấy sản phẩm
```json
{
  "status": "error",
  "message": "Không tìm thấy sản phẩm để cập nhật"
}
```

---

### 2.6. Xóa Một Sản Phẩm (Delete Product)
- **Mục đích:** Xóa hoàn toàn một sản phẩm ra khỏi hệ thống.
- **Method & Path:** `DELETE /api/v1/products/:id`
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **URL Parameters:**
  | Tên | Kiểu | Bắt buộc | Mô tả |
  | :--- | :--- | :--- | :--- |
  | `id` | `UUID` | Có | Định danh UUID của sản phẩm cần xóa |

- **Request Body:** Không có.
- **Responses:**

#### `200 OK` - Xóa thành công
```json
{
  "status": "success",
  "message": "Xóa sản phẩm thành công"
}
```

#### `404 Not Found` - Không tìm thấy sản phẩm
```json
{
  "status": "error",
  "message": "Không tìm thấy sản phẩm để xóa"
}
```

---

### 2.7. Xóa Nhiều Sản Phẩm (Bulk Delete Products)
- **Mục đích:** Xóa đồng thời nhiều sản phẩm theo danh sách các ID được truyền lên (dùng trong tính năng chọn nhiều sản phẩm trên dashboard quản trị).
- **Method & Path:** `POST /api/v1/products/bulk-delete` *(hoặc alias `DELETE /api/v1/products/bulk`)*
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin` hoặc `manager`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Request Body:**

```json
{
  "ids": [
    "b3e34bcf-697b-402a-a9a3-55913e7ce001",
    "b3e34bcf-697b-402a-a9a3-55913e7ce002"
  ]
}
```

- **Responses:**

#### `200 OK` - Xóa hàng loạt thành công
```json
{
  "status": "success",
  "message": "Đã xóa 2 sản phẩm thành công",
  "data": {
    "deletedCount": 2
  }
}
```

#### `400 Bad Request` - Danh sách ID không hợp lệ
```json
{
  "status": "error",
  "message": "Danh sách ID sản phẩm cần xóa không hợp lệ"
}
```
