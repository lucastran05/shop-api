# [TÊN MODULE] API SPECIFICATION
> **Mô tả tài liệu:** Đặc tả kỹ thuật các endpoint thuộc phân hệ [Tên Module / Feature]  
> **Tác giả:** [Tên người phụ trách / Team]  
> **Cập nhật lần cuối:** YYYY-MM-DD  
> **Trạng thái:** [Draft | In Review | Approved]  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ (Business Overview)

Mô tả ngắn gọn về vai trò, trách nhiệm nghiệp vụ và các quy tắc đặc thù của module này trong hệ thống:
- **Mục tiêu:** [Ví dụ: Quản lý giỏ hàng và đặt hàng của khách hàng]
- **Quy tắc nghiệp vụ chính:**
  - Quy tắc 1: [Ví dụ: Người dùng phải xác thực trước khi tạo đơn hàng]
  - Quy tắc 2: [Ví dụ: Số lượng sản phẩm phải còn tồn kho mới cho phép thanh toán]

---

## 2. Thông tin chung (General Information)

- **Base URL:** `/api/v1/[module-prefix]` (ví dụ: `/api/v1/products`)
- **Phân quyền truy cập (Role/Permission):**
  - `Public`: Người dùng vãng lai không cần đăng nhập.
  - `Customer`: Khách hàng đã đăng nhập có JWT hợp lệ.
  - `Admin`: Quản trị viên hệ thống có quyền quản lý toàn quyền.
- **Default Headers:**
  ```http
  Content-Type: application/json
  Accept: application/json
  Authorization: Bearer <access_token>
  ```

---

## 3. Danh sách Endpoints tóm tắt (Endpoint Summary)

| STT | Method | Endpoint Path | Quyền hạn (Role) | Mô tả ngắn |
| :---: | :---: | :--- | :--- | :--- |
| 1 | `GET` | `/api/v1/[resources]` | Public / Customer | Lấy danh sách tài nguyên có phân trang & lọc |
| 2 | `GET` | `/api/v1/[resources]/:id` | Public / Customer | Lấy chi tiết tài nguyên theo ID |
| 3 | `POST` | `/api/v1/[resources]` | Customer / Admin | Tạo mới một bản ghi tài nguyên |
| 4 | `PUT` | `/api/v1/[resources]/:id` | Admin | Cập nhật toàn bộ thông tin bản ghi |
| 5 | `DELETE`| `/api/v1/[resources]/:id` | Admin | Xóa mềm hoặc xóa vĩnh viễn tài nguyên |

---

## 4. Chi tiết từng Endpoint

### 4.1. [Tên thao tác 1: Tạo mới tài nguyên]

- **Mô tả nghiệp vụ:** Khách hàng hoặc Admin gửi thông tin để tạo mới một bản ghi [Tên tài nguyên].
- **Method:** `POST`
- **Path:** `/api/v1/[resources]`
- **Quyền hạn (Role):** `Customer`, `Admin`

#### Request Headers
| Header Key | Giá trị bắt buộc | Ghi chú |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Bắt buộc |
| `Authorization` | `Bearer <access_token>` | Bắt buộc với các endpoint yêu cầu đăng nhập |

#### URL / Path Parameters
*(Không có)*

#### Query Parameters
*(Không có)*

#### Request Body
- **Content-Type:** `application/json`
- **JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "price", "category_id"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 2,
      "maxLength": 255,
      "description": "Tên tài nguyên"
    },
    "price": {
      "type": "number",
      "minimum": 0,
      "description": "Đơn giá (VND)"
    },
    "category_id": {
      "type": "string",
      "format": "uuid",
      "description": "UUID của danh mục trực thuộc"
    },
    "description": {
      "type": "string",
      "description": "Mô tả chi tiết tùy chọn"
    }
  }
}
```

- **Ví dụ Payload (Request Body Sample):**
```json
{
  "name": "Bàn phím cơ Bluetooth RGB",
  "price": 1450000,
  "category_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "description": "Bàn phím cơ gõ êm, layout 75%, pin 4000mAh."
}
```

#### Responses Mẫu

##### Thành công: `201 Created`
```json
{
  "status": "success",
  "message": "Tạo tài nguyên thành công",
  "data": {
    "id": "7b8e5d32-2345-4ef0-911a-1299abf54101",
    "name": "Bàn phím cơ Bluetooth RGB",
    "price": 1450000,
    "category_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "description": "Bàn phím cơ gõ êm, layout 75%, pin 4000mAh.",
    "created_at": "2026-10-13T10:00:00.000Z",
    "updated_at": "2026-10-13T10:00:00.000Z"
  }
}
```

##### Thất bại - Dữ liệu không hợp lệ: `400 Bad Request`
```json
{
  "status": "error",
  "message": "Dữ liệu gửi lên không hợp lệ",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "price",
      "message": "Đơn giá phải là số dương lớn hơn hoặc bằng 0"
    }
  ]
}
```

##### Thất bại - Chưa xác thực: `401 Unauthorized`
```json
{
  "status": "error",
  "message": "Vui lòng đăng nhập để tiếp tục",
  "code": "UNAUTHORIZED"
}
```

##### Thất bại - Không có quyền: `403 Forbidden`
```json
{
  "status": "error",
  "message": "Bạn không có quyền thực hiện hành động này",
  "code": "FORBIDDEN"
}
```

##### Thất bại - Lỗi máy chủ: `500 Internal Server Error`
```json
{
  "status": "error",
  "message": "Lỗi máy chủ nội bộ. Vui lòng thử lại sau.",
  "code": "INTERNAL_SERVER_ERROR"
}
```

#### Lệnh cURL kiểm thử nhanh (cURL Example)
```bash
curl -X POST "http://localhost:5000/api/v1/[resources]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "name": "Bàn phím cơ Bluetooth RGB",
    "price": 1450000,
    "category_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "description": "Bàn phím cơ gõ êm, layout 75%, pin 4000mAh."
  }'
```

---

### 4.2. [Tên thao tác 2: Lấy danh sách tài nguyên có phân trang]

- **Mô tả nghiệp vụ:** Lấy danh sách các tài nguyên theo bộ lọc, tìm kiếm và phân trang.
- **Method:** `GET`
- **Path:** `/api/v1/[resources]`
- **Quyền hạn (Role):** `Public` (hoặc `Customer`)

#### Request Headers
| Header Key | Giá trị bắt buộc | Ghi chú |
| :--- | :--- | :--- |
| `Accept` | `application/json` | Bắt buộc |

#### URL / Path Parameters
*(Không có)*

#### Query Parameters
| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :---: | :---: | :---: | :--- |
| `page` | integer | Không | `1` | Trang hiện tại cần lấy |
| `limit` | integer | Không | `10` | Số lượng bản ghi trên một trang (tối đa 100) |
| `search` | string | Không | `""` | Từ khóa tìm kiếm theo tên |
| `sort_by` | string | Không | `created_at` | Thuộc tính dùng để sắp xếp (`price`, `created_at`, `name`) |
| `order` | string | Không | `desc` | Chiều sắp xếp (`asc` hoặc `desc`) |

#### Responses Mẫu

##### Thành công: `200 OK`
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "7b8e5d32-2345-4ef0-911a-1299abf54101",
        "name": "Bàn phím cơ Bluetooth RGB",
        "price": 1450000,
        "category_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "created_at": "2026-10-13T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total_items": 1,
      "current_page": 1,
      "page_size": 10,
      "total_pages": 1
    }
  }
}
```

#### Lệnh cURL kiểm thử nhanh (cURL Example)
```bash
curl -X GET "http://localhost:5000/api/v1/[resources]?page=1&limit=10&sort_by=price&order=desc" \
  -H "Accept: application/json"
```

---

## 5. Check-list kiểm thử trước khi nộp API (Definition of Done)
- [ ] Endpoint đã tuân thủ đúng định dạng `kebab-case` cho URL và `snake_case` cho Body.
- [ ] Đã kiểm tra đầy đủ các mã HTTP: 200/201, 400, 401, 403, 404, 500.
- [ ] Chạy lệnh cURL mẫu thành công trên môi trường Docker local.
- [ ] Đã thêm test case tương ứng vào bộ kiểm thử tự động (Unit / Integration Test).
