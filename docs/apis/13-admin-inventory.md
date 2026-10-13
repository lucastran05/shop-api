# 13. QUẢN LÝ KHO THEO BIẾN THỂ (ADMIN INVENTORY)
> **Mã phân hệ:** `INV`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Theo dõi tồn kho thực tế của từng biến thể sản phẩm, cảnh báo hàng sắp hết và ghi nhận lịch sử điều chỉnh nhập/xuất kho:
- **Quy tắc nghiệp vụ:**
  - Tồn kho được quản lý chi tiết đến từng biến thể (`variant_id`).
  - Ngưỡng cảnh báo sắp hết hàng mặc định: `low_stock_threshold = 5`.
  - Điều chỉnh tồn kho (`INV02`): Truyền giá trị `delta` (dương để tăng thêm khi nhập hàng, âm để giảm khi xuất kho/hư hại).
  - Nghiêm cấm trừ tồn kho dẫn đến `stock_after < 0`.
  - Mọi thao tác điều chỉnh kho đều ghi lại lịch sử bất biến (`audit log`) kèm thông tin người thực hiện (`actor: { id, name }`) và lý do (`reason`).

---

## 2. Thông tin chung

- **Base URL:** `/admin/inventory`
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **INV01** | `GET` | `/admin/inventory` | Manager / Admin | Danh sách tồn kho theo biến thể, lọc hàng sắp hết |
| **INV02** | `POST` | `/admin/inventory/adjustments` | Manager / Admin | Điều chỉnh tăng / giảm số lượng tồn kho |
| **INV03** | `GET` | `/admin/inventory/adjustments` | Manager / Admin | Lịch sử nhật ký các lần điều chỉnh tồn kho |

---

## 4. Chi tiết từng Endpoint

### 4.1. INV01 — Nạp danh sách tồn kho
- **Method:** `GET`
- **Path:** `/admin/inventory`
- **Query Parameters:** `keyword=akko&low_stock=true&page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "product_name": "Bàn phím cơ không dây AKKO 3084B Plus",
      "variant_id": "var-02",
      "variant_label": "CS Jelly Purple Switch",
      "color": "Tím / Trắng",
      "stock_quantity": 3,
      "is_low_stock": true
    }
  ],
  "low_stock_threshold": 5,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 4.2. INV02 — Điều chỉnh tồn kho
- **Method:** `POST`
- **Path:** `/admin/inventory/adjustments`
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: uuid-v4`

#### Request Body
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "variant_id": "var-02",
  "delta": 20,
  "reason": "Nhập thêm hàng từ nhà phân phối Akko Việt Nam"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Điều chỉnh tồn kho thành công",
  "data": {
    "id": "adj-1002",
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "variant_id": "var-02",
    "delta": 20,
    "stock_before": 3,
    "stock_after": 23,
    "reason": "Nhập thêm hàng từ nhà phân phối Akko Việt Nam",
    "actor": {
      "id": "admin-01",
      "name": "Quản Trị Viên Kho"
    },
    "created_at": "2026-10-13T09:45:00.000Z"
  }
}
```

---

### 4.3. INV03 — Xem lịch sử biến động kho
- **Method:** `GET`
- **Path:** `/admin/inventory/adjustments`
- **Query Parameters:** `product_id=550e8400-e29b-41d4-a716-446655440000&page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "adj-1002",
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "product_name": "Bàn phím cơ không dây AKKO 3084B Plus",
      "variant_id": "var-02",
      "variant_label": "CS Jelly Purple Switch",
      "delta": 20,
      "stock_before": 3,
      "stock_after": 23,
      "reason": "Nhập thêm hàng từ nhà phân phối Akko Việt Nam",
      "actor": { "id": "admin-01", "name": "Quản Trị Viên Kho" },
      "created_at": "2026-10-13T09:45:00.000Z"
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
