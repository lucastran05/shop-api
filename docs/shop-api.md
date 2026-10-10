# Tài Liệu API Cấu Hình Cửa Hàng (Shop Settings API)

Tài liệu kỹ thuật chi tiết về các endpoint quản lý cấu hình thông tin cửa hàng (Shop Information & Commercial Settings), cấu trúc bảng PostgreSQL `shop_settings` và cơ chế phân quyền quản trị tối cao trên ứng dụng **Shop API**.

---

## 1. Cấu Trúc Bảng Dữ Liệu `shop_settings` (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS shop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL DEFAULT 'ABC Shop',
  description TEXT DEFAULT 'Cửa hàng trực tuyến',
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  map_url TEXT,
  logo_url TEXT,
  banner_url TEXT,
  social_links JSONB DEFAULT '[]'::jsonb,
  commerce JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Chi tiết các trường:
| Cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | Khóa chính duy nhất định danh bản ghi cấu hình |
| `name` | `VARCHAR(255)` | NOT NULL | `'ABC Shop'` | Tên thương hiệu hiển thị trên website / hóa đơn |
| `description` | `TEXT` | NULL | `'Cửa hàng...'` | Giới thiệu tóm tắt / Slogan của cửa hàng |
| `phone` | `VARCHAR(50)` | NULL | NULL | Hotline liên hệ và chăm sóc khách hàng |
| `email` | `VARCHAR(255)` | NULL | NULL | Hòm thư điện tử tiếp nhận phản hồi |
| `address` | `TEXT` | NULL | NULL | Địa chỉ trụ sở hoặc showroom chính |
| `map_url` | `TEXT` | NULL | NULL | Link Google Maps chỉ đường đến cửa hàng |
| `logo_url` | `TEXT` | NULL | NULL | Đường dẫn ảnh logo thương hiệu (URL) |
| `banner_url` | `TEXT` | NULL | NULL | Đường dẫn ảnh banner trang chủ (URL) |
| `social_links`| `JSONB` | NULL | `'[]'` | Mảng danh sách các liên kết mạng xã hội (Facebook, Youtube, Zalo,...) |
| `commerce` | `JSONB` | NULL | `'{}'` | Cấu hình nghiệp vụ thương mại: Phí vận chuyển, ngưỡng miễn phí ship, tỷ lệ cọc |
| `created_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm khởi tạo bản ghi |
| `updated_at` | `TIMESTAMPTZ` | - | `CURRENT_TIMESTAMP` | Thời điểm cập nhật cấu hình gần nhất |

---

## 2. Nguyên Tắc Phân Quyền & Tự Khởi Tạo (Self-Healing)

1. **Xem thông tin cửa hàng (`GET`):** Hoàn toàn công khai (`Public`). Mọi khách hàng, bot tìm kiếm (SEO) đều có thể truy cập để lấy thông tin liên hệ, logo và chính sách vận chuyển.
2. **Cơ chế tự khởi tạo dữ liệu:** Nếu cơ sở dữ liệu chưa có bất kỳ bản ghi shop nào, khi có yêu cầu gọi `GET /api/v1/shop`, hệ thống sẽ tự động khởi tạo bản ghi mặc định ban đầu (`ABC Shop`) mà không bao giờ trả về lỗi 404.
3. **Cập nhật & Khôi phục (`POST`, `PUT`, `DELETE`):** Yêu cầu bắt buộc phải đăng nhập và sở hữu vai trò Quản trị viên tối cao (`role: admin`).

---

## 3. Chi Tiết Các Endpoint Cửa Hàng

### 3.1. Lấy Thông Tin Cửa Hàng (Get Shop Info)
- **Mục đích:** Khách hàng hoặc giao diện frontend lấy toàn bộ thông tin nhận diện thương hiệu, thông tin liên lạc và các cài đặt thương mại của shop.
- **Method & Path:** `GET /api/v1/shop`
- **Authentication/Authorization:** Không yêu cầu (Public).
- **Headers:**
  - `Accept: application/json`
- **Responses:**

#### `200 OK` - Lấy thông tin thành công
```json
{
  "status": "success",
  "data": {
    "shop": {
      "id": "1f8e7d6c-5b4a-3928-10fe-dcba98765432",
      "name": "ABC Tech Store Official",
      "description": "Hệ sinh thái thiết bị & giải pháp công nghệ chính hãng hàng đầu Việt Nam",
      "phone": "0988776655",
      "email": "hotro@abctech.vn",
      "address": "456 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
      "mapUrl": "https://maps.google.com/?q=ABCTechStore",
      "logoUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      "bannerUrl": "https://images.unsplash.com/photo-1550745165-9bc0b252726f",
      "contact": {
        "phone": "0988776655",
        "email": "hotro@abctech.vn",
        "address": "456 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
        "mapUrl": "https://maps.google.com/?q=ABCTechStore",
        "socialLinks": [
          { "platform": "facebook", "url": "https://facebook.com/abctechstore" },
          { "platform": "youtube", "url": "https://youtube.com/@abctechstore" }
        ]
      },
      "commerce": {
        "freeShippingFrom": 500000,
        "shippingFee": 30000,
        "depositRate": 0.2
      },
      "createdAt": "2026-10-10T12:00:00.000Z",
      "updatedAt": "2026-10-10T14:30:00.000Z"
    }
  }
}
```

---

### 3.2. Cập Nhật Thông Tin Cửa Hàng (Update Shop Info)
- **Mục đích:** Quản trị viên cập nhật lại tên shop, hotline, logo, banner hoặc các thông số vận chuyển.
- **Method & Path:** `PUT /api/v1/shop` *(hoặc `POST /api/v1/shop`)*
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Request Body:**

```json
{
  "name": "ABC Tech Store Official",
  "description": "Hệ sinh thái thiết bị & giải pháp công nghệ chính hãng hàng đầu Việt Nam",
  "phone": "0988776655",
  "email": "hotro@abctech.vn",
  "address": "456 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
  "mapUrl": "https://maps.google.com/?q=ABCTechStore",
  "logoUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
  "bannerUrl": "https://images.unsplash.com/photo-1550745165-9bc0b252726f",
  "socialLinks": [
    { "platform": "facebook", "url": "https://facebook.com/abctechstore" },
    { "platform": "youtube", "url": "https://youtube.com/@abctechstore" }
  ],
  "commerce": {
    "freeShippingFrom": 500000,
    "shippingFee": 30000,
    "depositRate": 0.2
  }
}
```

- **Responses:**

#### `200 OK` - Cập nhật thành công
```json
{
  "status": "success",
  "message": "Cập nhật thông tin cửa hàng thành công",
  "data": {
    "shop": {
      "id": "1f8e7d6c-5b4a-3928-10fe-dcba98765432",
      "name": "ABC Tech Store Official",
      "updatedAt": "2026-10-10T14:30:00.000Z"
    }
  }
}
```

#### `400 Bad Request` - Tên cửa hàng rỗng
```json
{
  "status": "error",
  "message": "Tên cửa hàng không được để trống"
}
```

#### `403 Forbidden` - Không phải Admin
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin)"
}
```

---

### 3.3. Khôi Phục Cài Đặt Mặc Định (Reset Shop Info)
- **Mục đích:** Xóa dữ liệu tùy biến và khôi phục toàn bộ cấu hình shop về giá trị mặc định ban đầu của hệ thống.
- **Method & Path:** `POST /api/v1/shop/reset` *(hoặc alias `DELETE /api/v1/shop/reset`)*
- **Authentication/Authorization:** `Bearer Token` (`accessToken`). Yêu cầu vai trò: `admin`.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `Accept: application/json`
- **Request Body:** Không có.
- **Responses:**

#### `200 OK` - Khôi phục thành công
```json
{
  "status": "success",
  "message": "Khôi phục thông tin cửa hàng về mặc định thành công",
  "data": {
    "shop": {
      "id": "2a3b4c5d-6e7f-8901-2345-6789abcdef01",
      "name": "ABC Shop",
      "description": "Cửa hàng trực tuyến",
      "phone": "0901234567",
      "email": "contact@abcshop.vn",
      "address": "12 Nguyễn Trãi, Hà Nội",
      "commerce": {
        "freeShippingFrom": 500000,
        "shippingFee": 30000,
        "depositRate": 0.2
      }
    }
  }
}
```

#### `403 Forbidden` - Không phải Admin
```json
{
  "status": "error",
  "message": "Bạn không có quyền truy cập tài nguyên này (yêu cầu vai trò: admin)"
}
```
