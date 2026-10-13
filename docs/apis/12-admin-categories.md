# 12. QUẢN TRỊ DANH MỤC SẢN PHẨM (ADMIN CATEGORIES)
> **Mã phân hệ:** `ADC`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý các danh mục phân loại sản phẩm trong cửa hàng:
- **Quy tắc nghiệp vụ:**
  - Danh mục chứa các trường: `id`, `name`, `product_count`, `created_at`, `updated_at`.
  - **Quy tắc an toàn khi xóa:** Không cho phép xóa danh mục vẫn đang chứa sản phẩm (`product_count > 0`). Nếu cố gắng xóa, trả về lỗi nghiệp vụ kèm thông báo yêu cầu chuyển hoặc xóa sản phẩm trước.
  - Khi xóa hàng loạt (`ADC05`), hệ thống sẽ xóa các danh mục rỗng hợp lệ và trả về các danh mục không thể xóa trong mảng `failed[]`.

---

## 2. Thông tin chung

- **Base URL:** `/admin/categories`
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **ADC01** | `GET` | `/admin/categories` | Manager / Admin | Danh sách tất cả danh mục kèm số lượng sản phẩm |
| **ADC02** | `POST` | `/admin/categories` | Manager / Admin | Thêm mới danh mục sản phẩm |
| **ADC03** | `PATCH` | `/admin/categories/:id` | Manager / Admin | Đổi tên danh mục |
| **ADC04** | `DELETE` | `/admin/categories/:id` | Manager / Admin | Xóa một danh mục rỗng |
| **ADC05** | `POST` | `/admin/categories/bulk-delete` | Manager / Admin | Xóa nhiều danh mục đã chọn |

---

## 4. Chi tiết từng Endpoint

### 4.1. ADC01 — Danh sách danh mục quản trị
- **Method:** `GET`
- **Path:** `/admin/categories`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Bàn phím cơ",
      "product_count": 28,
      "created_at": "2026-10-10T00:00:00.000Z",
      "updated_at": "2026-10-12T10:00:00.000Z"
    }
  ]
}
```

---

### 4.2. ADC02 — Thêm danh mục mới
- **Method:** `POST`
- **Path:** `/admin/categories`

#### Request Body
```json
{
  "name": "Tai nghe Gaming"
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "data": {
    "id": "cat-headphone-01",
    "name": "Tai nghe Gaming",
    "product_count": 0,
    "created_at": "2026-10-13T09:40:00.000Z",
    "updated_at": "2026-10-13T09:40:00.000Z"
  }
}
```

---

### 4.3. ADC04 — Xóa một danh mục
- **Method:** `DELETE`
- **Path:** `/admin/categories/:category_id`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Xóa danh mục thành công",
  "data": {
    "deleted_id": "cat-headphone-01"
  }
}
```
- **`400 Bad Request`**: Danh mục vẫn còn sản phẩm.
```json
{
  "status": "error",
  "message": "Không thể xóa danh mục đang có 28 sản phẩm",
  "code": "CATEGORY_NOT_EMPTY"
}
```
