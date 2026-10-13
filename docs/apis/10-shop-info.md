# 10. THÔNG TIN CỬA HÀNG (SHOP INFO)
> **Mã phân hệ:** `SHOP`  
> **Phạm vi:** Khách hàng, Công khai  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Cung cấp các thông tin công khai về cửa hàng để hiển thị lên Header, Footer, trang Giới thiệu (`/shop-info`) và liên hệ:
- **Quy tắc nghiệp vụ:**
  - Endpoint hoàn toàn công khai, không yêu cầu đăng nhập.
  - Cung cấp tên cửa hàng, mô tả, hình thức kinh doanh (`business_mode`: trực tuyến, trực tiếp), thông tin liên hệ (địa chỉ, hotline, email, link Google Maps) và các liên kết mạng xã hội (`social_links`).

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/shop`
- **Quyền hạn truy cập:** Toàn bộ công khai (`Public`).

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **SHOP01** | `GET` | `/api/v1/shop` | Public | Lấy toàn bộ thông tin công khai và liên hệ của cửa hàng |

---

## 4. Chi tiết từng Endpoint

### 4.1. SHOP01 — Xem thông tin cửa hàng
- **Method:** `GET`
- **Path:** `/api/v1/shop`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "shop-main",
    "name": "ABC Tech Gear Store",
    "description": "Cửa hàng phụ kiện máy tính, bàn phím cơ và thiết bị công nghệ chính hãng chất lượng cao.",
    "business_mode": "online_and_store",
    "contact": {
      "address": "Tầng 5, Tòa nhà ABC, Phố Huế, Hai Bà Trưng, Hà Nội",
      "phone": "1900 6868",
      "email": "support@abcshop.vn",
      "map_url": "https://maps.google.com/?q=ABC+Tech+Store",
      "social_links": [
        { "label": "Facebook", "url": "https://facebook.com/abctech" },
        { "label": "Shopee", "url": "https://shopee.vn/abctech" }
      ]
    },
    "updated_at": "2026-10-10T00:00:00.000Z"
  }
}
```

#### Lệnh cURL
```bash
curl -X GET "http://localhost:5000/api/v1/shop"
```
