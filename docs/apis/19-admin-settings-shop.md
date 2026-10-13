# 19. CẤU HÌNH CỬA HÀNG QUẢN TRỊ (ADMIN SETTINGS SHOP)
> **Mã phân hệ:** `SET`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Cập nhật thông tin nhận diện thương hiệu của cửa hàng, hotline, địa chỉ trụ sở và liên kết mạng xã hội:
- **Quy tắc nghiệp vụ:**
  - `SET01`: Lấy dữ liệu cấu hình hiện tại để hiển thị lên form cài đặt hệ thống.
  - `SET02`: Cập nhật thông tin công khai của shop. Sau khi cập nhật thành công, dữ liệu này lập tức có hiệu lực và làm mới dữ liệu trả về của API công khai `GET /api/v1/shop` (`SHOP01`).

---

## 2. Thông tin chung

- **Base URL:** `/admin/settings/shop`
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **SET01** | `GET` | `/admin/settings/shop` | Manager / Admin | Lấy dữ liệu cấu hình shop để điền vào form cài đặt |
| **SET02** | `PATCH` | `/admin/settings/shop` | Manager / Admin | Lưu thông tin cấu hình cửa hàng công khai |

---

## 4. Chi tiết từng Endpoint

### 4.1. SET01 — Nạp form cấu hình shop
- **Method:** `GET`
- **Path:** `/admin/settings/shop`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "shop-main",
    "name": "ABC Tech Gear Store",
    "description": "Cửa hàng phụ kiện máy tính chính hãng.",
    "business_mode": "online_and_store",
    "contact": {
      "address": "Tầng 5, Tòa nhà ABC, Phố Huế, Hai Bà Trưng, Hà Nội",
      "phone": "1900 6868",
      "email": "support@abcshop.vn",
      "map_url": "https://maps.google.com/?q=ABC+Tech+Store",
      "social_links": [
        { "label": "Facebook", "url": "https://facebook.com/abctech" }
      ]
    },
    "updated_at": "2026-10-10T00:00:00.000Z"
  }
}
```

---

### 4.2. SET02 — Lưu thông tin cấu hình shop
- **Method:** `PATCH`
- **Path:** `/admin/settings/shop`

#### Request Body
```json
{
  "name": "ABC Tech Gear Official Store",
  "description": "Hệ thống bán lẻ thiết bị máy tính, gear gaming và phụ kiện công nghệ cao cấp.",
  "business_mode": "online_and_store",
  "contact": {
    "address": "Tầng 5, Tòa nhà ABC, Phố Huế, Hai Bà Trưng, Hà Nội",
    "phone": "1900 8899",
    "email": "hotro@abcshop.vn",
    "map_url": "https://maps.google.com/?q=ABC+Tech+Store"
  }
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Cập nhật cấu hình cửa hàng thành công",
  "data": {
    "id": "shop-main",
    "name": "ABC Tech Gear Official Store",
    "description": "Hệ thống bán lẻ thiết bị máy tính, gear gaming và phụ kiện công nghệ cao cấp.",
    "business_mode": "online_and_store",
    "contact": {
      "address": "Tầng 5, Tòa nhà ABC, Phố Huế, Hai Bà Trưng, Hà Nội",
      "phone": "1900 8899",
      "email": "hotro@abcshop.vn",
      "map_url": "https://maps.google.com/?q=ABC+Tech+Store",
      "social_links": [
        { "label": "Facebook", "url": "https://facebook.com/abctech" }
      ]
    },
    "updated_at": "2026-10-13T10:10:00.000Z"
  }
}
```

#### Lệnh cURL
```bash
curl -X PATCH "http://localhost:5000/admin/settings/shop" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Tech Gear Official Store",
    "contact": {
      "phone": "1900 8899"
    }
  }'
```
