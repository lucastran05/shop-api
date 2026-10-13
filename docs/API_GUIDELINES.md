# HƯỚNG DẪN VÀ QUY ƯỚC VIẾT TÀI LIỆU API (API GUIDELINES)
> **Tài liệu chuẩn hóa kiến trúc RESTful API và tài liệu hóa cho dự án Shop API**  
> **Người biên soạn:** Lead Software Engineer & DevOps  
> **Áp dụng cho:** Toàn bộ thành viên phát triển Backend, Frontend, QA/QC  

---

## 1. Tổng quan & Mục đích

Tài liệu này xác định các quy chuẩn thống nhất về thiết kế, đặt tên, xác thực, mã phản hồi và định dạng dữ liệu cho toàn bộ các dịch vụ API của hệ thống Shop. Việc chuẩn hóa giúp:
- Đảm bảo tính nhất quán trên toàn bộ codebase giữa các feature team.
- Giảm thiểu hiểu lầm khi tích hợp giữa Frontend (Web/Mobile) và Backend.
- Tự động hóa và chuẩn hóa quy trình viết tài liệu kỹ thuật tại `docs/apis/<module-name>.md`.

---

## 2. Quy ước đặt tên (Naming Conventions)

### 2.1. Đường dẫn URI (Endpoint Paths)
- Sử dụng **danh từ số nhiều** cho các tài nguyên (resources): `/users`, `/products`, `/orders`, `/categories`.
- Sử dụng chữ thường và dấu gạch nối (**kebab-case**) cho đường dẫn nhiều từ:
  - ✅ Hợp lệ: `/api/v1/order-items`, `/api/v1/user-profiles`
  - ❌ Không hợp lệ: `/api/v1/orderItems`, `/api/v1/order_items`
- Không sử dụng động từ trong URI (hãy để HTTP Methods thể hiện hành động):
  - ✅ Hợp lệ: `POST /api/v1/products`
  - ❌ Không hợp lệ: `POST /api/v1/createProduct`, `GET /api/v1/getProducts`
- Đối với các hành động phi tài nguyên (RPC-style hoặc actions đặc thù), sử dụng động từ ở đuôi sau dấu gạch chéo:
  - Ví dụ: `POST /api/v1/users/login`, `POST /api/v1/users/refresh-token`, `POST /api/v1/orders/:id/cancel`

### 2.2. Trường dữ liệu (JSON Keys & Parameters)
- Toàn bộ thuộc tính trong JSON Request Body, Response Body và Query Parameters đều tuân thủ **`snake_case`**:
  - Request/Response: `user_id`, `created_at`, `refresh_token`, `phone_number`, `order_status`
  - Query parameters: `?page=1&limit=10&sort_by=price&order=desc`
- Đường dẫn tham số (Path Parameters) dùng dấu hai chấm kèm tên snake_case:
  - `GET /api/v1/products/:id` hoặc `GET /api/v1/categories/:category_id`

---

## 3. Quy ước HTTP Methods chuẩn ngữ nghĩa

| Phương thức | Ý nghĩa & Mục đích sử dụng | Tính lũy đẳng (Idempotent) | Tính an toàn (Safe) |
| :--- | :--- | :---: | :---: |
| **`GET`** | Lấy thông tin tài nguyên hoặc danh sách tài nguyên. Không làm biến đổi dữ liệu. | Có | Có |
| **`POST`** | Tạo mới tài nguyên, hoặc thực hiện một tác vụ xử lý (đăng nhập, thanh toán, upload). | Không | Không |
| **`PUT`** | Thay thế hoặc cập nhật **toàn bộ** bản ghi hiện có bằng dữ liệu mới. | Có | Không |
| **`PATCH`** | Cập nhật **một phần** các trường dữ liệu của bản ghi. | Không | Không |
| **`DELETE`** | Xóa một tài nguyên theo định danh. | Có | Không |

---

## 4. Bảng mã trạng thái HTTP (HTTP Status Codes)

Mỗi phản hồi API bắt buộc phải trả về đúng mã trạng thái HTTP theo ngữ cảnh thực tế:

### 4.1. Nhóm 2xx - Thành công (Success)
- **`200 OK`**: Yêu cầu xử lý thành công (thường dùng cho `GET`, `PUT`, `PATCH`, hoặc `DELETE` trả về payload).
- **`201 Created`**: Tạo mới tài nguyên thành công (bắt buộc dùng cho `POST` tạo bản ghi mới).
- **`204 No Content`**: Xử lý thành công nhưng không có nội dung trả về trong Body (ví dụ: `DELETE` thành công).

### 4.2. Nhóm 4xx - Lỗi từ phía Client (Client Errors)
- **`400 Bad Request`**: Dữ liệu gửi lên không đúng định dạng cú pháp JSON, thiếu tham số bắt buộc, hoặc vi phạm validation logic sơ cấp.
- **`401 Unauthorized`**: Người dùng chưa xác thực (thiếu Bearer Token, Token hết hạn, chữ ký không hợp lệ).
- **`403 Forbidden`**: Người dùng đã xác thực nhưng không có quyền truy cập tài nguyên (ví dụ: Customer cố gọi API dành riêng cho Admin, tài khoản bị khóa `active = false`).
- **`404 Not Found`**: Không tìm thấy tài nguyên theo URL hoặc ID yêu cầu.
- **`409 Conflict`**: Xung đột trạng thái dữ liệu (ví dụ: Đăng ký với Email đã tồn tại trong hệ thống).
- **`422 Unprocessable Entity`**: Dữ liệu đúng cú pháp nhưng vi phạm quy tắc nghiệp vụ (ví dụ: Số lượng đặt mua vượt quá tồn kho).
- **`429 Too Many Requests`**: Vượt quá giới hạn tần suất gọi API (Rate limiting).

### 4.3. Nhóm 5xx - Lỗi từ phía Server (Server Errors)
- **`500 Internal Server Error`**: Lỗi hệ thống không lường trước (Database sập, crash mã nguồn ngoại lệ). Tuyệt đối không để lộ chi tiết stack trace ra ngoài production.
- **`502 Bad Gateway`**: Lỗi kết nối tới upstream server hoặc microservice thứ 3.
- **`503 Service Unavailable`**: Hệ thống đang bảo trì hoặc quá tải tạm thời.

---

## 5. Chuẩn Xác thực & Phân quyền (Authentication & Authorization)

### 5.1. Header xác thực
Tất cả các API yêu cầu xác thực người dùng bắt buộc truyền JWT qua HTTP Header:
```http
Authorization: Bearer <access_token>
```

### 5.2. Chu trình xử lý Token (Token Lifecycle)
Hệ thống sử dụng cơ chế bảo mật kép Access Token & Refresh Token độc lập:
1. **Access Token**:
   - Thời gian sống ngắn: Mặc định `15m` (`JWT_ACCESS_EXPIRES_IN`).
   - Dùng để gắn vào Header gọi các tài nguyên bảo vệ.
   - Chứa payload tối thiểu: `{ id, email, role, token_type: "access" }`.
2. **Refresh Token**:
   - Thời gian sống dài: Mặc định `7d` (`JWT_REFRESH_EXPIRES_IN`).
   - Dùng duy nhất tại endpoint `/api/v1/users/refresh-token` để lấy cặp token mới.
   - Cơ chế xoay vòng token (**Refresh Token Rotation - RTR**): Mỗi khi sử dụng refresh token hợp lệ, hệ thống sẽ cấp refresh token mới và lưu băm SHA-256 vào database.
   - **Phát hiện tái sử dụng token (Token Reuse Detection)**: Nếu phát hiện một refresh token cũ đã bị thu hồi được gửi lên, hệ thống sẽ lập tức vô hiệu hóa toàn bộ phiên đăng nhập của người dùng đó.

---

## 6. Cấu trúc Schema Response chuẩn (Response Envelope)

Mọi endpoint trong dự án phải trả về dữ liệu theo cấu trúc bọc (Envelope) thống nhất sau đây:

### 6.1. Phản hồi thành công (Success Response)
```json
{
  "status": "success",
  "message": "Mô tả ngắn gọn kết quả thao tác (tùy chọn)",
  "data": {
    "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
    "email": "customer@example.com",
    "role": "customer",
    "created_at": "2026-10-13T09:00:00.000Z"
  }
}
```

### 6.2. Phản hồi danh sách có phân trang (Paginated Success Response)
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Bàn phím cơ không dây",
        "price": 1250000
      }
    ],
    "pagination": {
      "total_items": 48,
      "current_page": 1,
      "page_size": 10,
      "total_pages": 5
    }
  }
}
```

### 6.3. Phản hồi lỗi chuẩn (Standard Error Response)
```json
{
  "status": "error",
  "message": "Dữ liệu gửi lên không hợp lệ",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Email không đúng định dạng hợp lệ"
    },
    {
      "field": "password",
      "message": "Mật khẩu phải chứa ít nhất 6 ký tự"
    }
  ]
}
```

---

## 7. Quy ước phân trang, lọc và sắp xếp (Query Parameters)

Khi viết API truy vấn danh sách (`GET`), áp dụng các tham số chuẩn sau:

| Tham số | Kiểu dữ liệu | Mặc định | Ý nghĩa |
| :--- | :---: | :---: | :--- |
| `page` | integer | `1` | Số trang hiện tại (bắt đầu từ 1) |
| `limit` | integer | `10` | Số lượng bản ghi trên một trang (tối đa 100) |
| `sort_by` | string | `created_at` | Tên trường cần sắp xếp (`price`, `name`, `created_at`) |
| `order` | string | `desc` | Thứ tự sắp xếp: `asc` (tăng dần) hoặc `desc` (giảm dần) |
| `search` | string | `null` | Từ khóa tìm kiếm toàn văn hoặc theo tên |
| `filter` / `status` | string | `null` | Bộ lọc theo trạng thái (ví dụ: `active=true`, `status=completed`) |

---

## 8. Hướng dẫn tổ chức tài liệu module API trong `docs/apis/`

### 8.1. Cấu trúc thư mục
Mỗi nhóm tính năng/module tạo một file Markdown riêng biệt theo mẫu:
```text
docs/
├── API_GUIDELINES.md          # File quy chuẩn chung này
└── apis/
    ├── template.md            # File mẫu chuẩn (Dùng để copy khi tạo module mới)
    ├── auth.md                # Tài liệu nhóm Authentication & Authorization
    ├── users.md               # Tài liệu nhóm Quản lý người dùng & Profile
    ├── products.md            # Tài liệu nhóm Sản phẩm & Danh mục
    ├── orders.md              # Tài liệu nhóm Đơn hàng & Giỏ hàng
    ├── payments.md            # Tài liệu nhóm Thanh toán & Giao dịch
    └── notifications.md       # Tài liệu nhóm Thông báo hệ thống
```

### 8.2. Quy trình viết tài liệu khi làm tính năng mới
1. Sao chép nội dung từ `docs/apis/template.md` sang file mới: `docs/apis/<module-name>.md`.
2. Điền đầy đủ mô tả nghiệp vụ, Base URL, Role phân quyền cho từng endpoint.
3. Cung cấp ví dụ JSON Request/Response thực tế, không dùng dữ liệu trừu tượng hoặc để trống.
4. Bắt buộc cung cấp **lệnh cURL thực tế** đã kiểm tra chạy thành công.
5. Tạo Pull Request và gắn nhãn `documentation` để Tech Lead review.
