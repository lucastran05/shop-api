# 02. ĐỊA CHỈ NHẬN HÀNG VÀ DANH MỤC ĐỊA PHƯƠNG (ADDRESSES & LOCATIONS)
> **Mã phân hệ:** `ADR`  
> **Phạm vi:** Khách hàng cá nhân, Danh mục hành chính công khai  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý sổ địa chỉ giao hàng của từng khách hàng và danh mục địa lý hành chính (tỉnh/thành phố và xã/phường) chuẩn hóa:
- **Quy tắc nghiệp vụ:**
  - Mỗi tài khoản có thể lưu nhiều địa chỉ nhận hàng, nhưng chỉ có **duy nhất 1 địa chỉ mặc định** (`is_default = true`).
  - Khi thêm hoặc đặt một địa chỉ làm mặc định, hệ thống tự động gỡ trạng thái mặc định của các địa chỉ còn lại.
  - Xóa địa chỉ mặc định sẽ tự động cập nhật trường `default_address_id` của tài khoản về `null` hoặc gán địa chỉ kế tiếp.
  - Danh mục địa phương cung cấp mã chuẩn (`province_code`, `ward_code`) dùng để validate và tính cước vận chuyển chuẩn xác.

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/me/addresses` và `/api/v1/locations`
- **Quyền hạn truy cập:**
  - Sổ địa chỉ (`ADR01` — `ADR05`): Khách hàng đã đăng nhập (`Customer`).
  - Danh mục địa phương (`ADR06` — `ADR07`): Công khai (`Public`).

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **ADR01** | `GET` | `/api/v1/me/addresses` | Customer | Lấy danh sách địa chỉ nhận hàng của người dùng |
| **ADR02** | `POST` | `/api/v1/me/addresses` | Customer | Thêm một địa chỉ nhận hàng mới |
| **ADR03** | `PATCH` | `/api/v1/me/addresses/:address_id` | Customer | Cập nhật thông tin một địa chỉ cụ thể |
| **ADR04** | `DELETE` | `/api/v1/me/addresses/:address_id` | Customer | Xóa một địa chỉ khỏi sổ địa chỉ |
| **ADR05** | `PATCH` | `/api/v1/me/addresses/:address_id/default` | Customer | Thiết lập địa chỉ làm mặc định |
| **ADR06** | `GET` | `/api/v1/locations/provinces` | Public | Lấy danh sách tất cả tỉnh / thành phố |
| **ADR07** | `GET` | `/api/v1/locations/wards` | Public | Lấy danh sách xã / phường theo tỉnh |

---

## 4. Chi tiết từng Endpoint

### 4.1. ADR01 — Lấy danh sách địa chỉ của tôi
- **Method:** `GET`
- **Path:** `/api/v1/me/addresses`
- **Headers:** `Authorization: Bearer <token>`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "7b8e5d32-2345-4ef0-911a-1299abf54101",
      "recipient_name": "Nguyễn Văn A",
      "recipient_phone": "0987654321",
      "province_code": "01",
      "province_name": "Hà Nội",
      "ward_code": "00001",
      "ward_name": "Phường Phúc Xá",
      "street_address": "Số 123 đường Hồng Hà",
      "full_address": "Số 123 đường Hồng Hà, Phường Phúc Xá, Hà Nội",
      "is_default": true
    }
  ]
}
```

---

### 4.2. ADR02 — Thêm địa chỉ mới
- **Method:** `POST`
- **Path:** `/api/v1/me/addresses`
- **Headers:** `Authorization: Bearer <token>`

#### Request Body
```json
{
  "recipient_name": "Nguyễn Văn A",
  "recipient_phone": "0987654321",
  "province_code": "79",
  "ward_code": "26734",
  "street_address": "Số 456 đường Lê Lợi",
  "is_default": true
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "message": "Thêm địa chỉ thành công",
  "data": {
    "id": "c928419b-6d12-40f9-a2e1-45612398ab77",
    "recipient_name": "Nguyễn Văn A",
    "recipient_phone": "0987654321",
    "province_code": "79",
    "province_name": "Hồ Chí Minh",
    "ward_code": "26734",
    "ward_name": "Phường Bến Nghé",
    "street_address": "Số 456 đường Lê Lợi",
    "full_address": "Số 456 đường Lê Lợi, Phường Bến Nghé, Hồ Chí Minh",
    "is_default": true
  }
}
```

---

### 4.3. ADR03 — Cập nhật địa chỉ
- **Method:** `PATCH`
- **Path:** `/api/v1/me/addresses/:address_id`
- **Headers:** `Authorization: Bearer <token>`

#### Request Body
```json
{
  "recipient_phone": "0912334455",
  "street_address": "Số 458 đường Lê Lợi (Tầng 2)"
}
```

#### Responses Mẫu
- **`200 OK`**: Trả về object địa chỉ sau khi cập nhật.

---

### 4.4. ADR04 — Xóa địa chỉ
- **Method:** `DELETE`
- **Path:** `/api/v1/me/addresses/:address_id`
- **Headers:** `Authorization: Bearer <token>`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Xóa địa chỉ thành công",
  "data": {
    "deleted_id": "c928419b-6d12-40f9-a2e1-45612398ab77",
    "default_address_id": null
  }
}
```

---

### 4.5. ADR05 — Đặt làm địa chỉ mặc định
- **Method:** `PATCH`
- **Path:** `/api/v1/me/addresses/:address_id/default`
- **Headers:** `Authorization: Bearer <token>`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Đã thiết lập địa chỉ mặc định",
  "data": {
    "id": "7b8e5d32-2345-4ef0-911a-1299abf54101",
    "is_default": true,
    "default_address_id": "7b8e5d32-2345-4ef0-911a-1299abf54101"
  }
}
```

---

### 4.6. ADR06 — Danh sách tỉnh / thành phố
- **Method:** `GET`
- **Path:** `/api/v1/locations/provinces`
- **Quyền hạn:** Public

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    { "code": "01", "name": "Thành phố Hà Nội" },
    { "code": "79", "name": "Thành phố Hồ Chí Minh" },
    { "code": "48", "name": "Thành phố Đà Nẵng" }
  ]
}
```

---

### 4.7. ADR07 — Danh sách xã / phường theo tỉnh
- **Method:** `GET`
- **Path:** `/api/v1/locations/wards`
- **Query Parameters:** `province_code=79`
- **Quyền hạn:** Public

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    { "code": "26734", "name": "Phường Bến Nghé", "province_code": "79" },
    { "code": "26737", "name": "Phường Bến Thành", "province_code": "79" }
  ]
}
```

#### Lệnh cURL
```bash
curl -X GET "http://localhost:5000/api/v1/locations/wards?province_code=79"
```
