# Shop app API
## 1. Tech Stack

- **Runtime Environment:** [Node.js (v18+)](https://nodejs.org/)
- **Web Framework:** [Express.js (v4+)](https://expressjs.com/)
- **Kiểu Module:** ES Modules (`"type": "module"`)
- **Bảo mật & Tiện ích HTTP:**
  - `cors`: Cấu hình chia sẻ tài nguyên nguồn gốc chéo (Cross-Origin Resource Sharing) kết nối với frontend `shop-web`.
  - `helmet`: Thiết lập HTTP headers bảo mật cho API.
  - `morgan`: Logger ghi nhận log request HTTP trong môi trường phát triển.
  - `dotenv`: Quản lý biến môi trường bảo mật qua file `.env`.
- **Gợi ý công cụ mở rộng:** [Mongoose](https://mongoosejs.com/) / [Sequelize](https://sequelize.org/), [JSON Web Token (jsonwebtoken)](https://jwt.io/), [bcryptjs](https://www.npmjs.com/package/bcryptjs), [Joi](https://joi.dev/) / [Zod](https://zod.dev/).

---

## 2. Cấu Trúc Xương Sống Dự Án

Cấu trúc dự án chỉ khởi tạo các thư mục lớn cấp 1 trong `src/` nhằm định hình khung kiến trúc chuẩn, để các thành viên tự do phát triển các module chức năng (Auth, User, Product, Order, Cart,...) theo nhu cầu:

```text
shop-api/
├── src/
│   ├── config/             # Cấu hình hệ thống (kết nối Database, biến môi trường, dịch vụ bên thứ 3)
│   ├── constants/          # Các hằng số dùng chung (HTTP Status, User Roles, Order Status, Message,...)
│   ├── controllers/        # Tiếp nhận request, điều phối gọi Service và trả về HTTP response
│   ├── middlewares/        # Các middleware trung gian (Authentication, Authorization, Error Handler,...)
│   ├── models/             # Định nghĩa cấu trúc Schema và Model cơ sở dữ liệu (MongoDB, PostgreSQL, MySQL,...)
│   ├── routes/             # Khai báo các endpoint URL của API và ánh xạ tới Controller
│   ├── services/           # Tầng xử lý logic nghiệp vụ chính (Business Logic) và truy vấn dữ liệu
│   ├── utils/              # Các hàm tiện ích dùng chung (tạo JWT token, hash mật khẩu, response formatter,...)
│   ├── validations/        # Schema kiểm tra tính hợp lệ dữ liệu đầu vào của request (Joi, Zod,...)
│   ├── app.js              # Khởi tạo Express app, cấu hình middlewares toàn cục và router
│   └── server.js           # Điểm khởi chạy (Entry point) lắng nghe kết nối trên cổng server
├── .env.example            # File mẫu danh sách các biến môi trường cần thiết
├── .gitignore              # Danh sách các tệp và thư mục loại trừ khỏi Git (node_modules, .env,...)
├── package.json            # Khai báo dependencies, metadata và scripts chạy lệnh
└── README.md               # Tài liệu hướng dẫn cấu trúc và chức năng từng thư mục
```

---

## 3. Bảng Chi Tiết Nhiệm Vụ Từng Thư Mục

| Thư mục | Chức năng lưu trữ & Nhiệm vụ |
| :--- | :--- |
| `src/config/` | Quản lý kết nối cơ sở dữ liệu (ví dụ: `db.js`), cấu hình Cloudinary (lưu ảnh sản phẩm), cấu hình cổng thanh toán (VNPAY/Momo), cấu hình gửi mail (Nodemailer),... |
| `src/constants/` | Tập trung toàn bộ hằng số cố định trong hệ thống: mã lỗi HTTP (`StatusCodes`), vai trò người dùng (`ROLES.ADMIN`, `ROLES.CUSTOMER`), trạng thái đơn hàng (`ORDER_STATUS.PENDING`),... tránh viết chuỗi cứng (magic strings). |
| `src/controllers/` | Tầng điều khiển tiếp nhận `req` (params, body, query) từ client, gọi hàm tương ứng ở tầng `services/` để xử lý và trả về phản hồi `res` (HTTP status code, JSON data). Giữ cho controller gọn gàng, không nhồi nhét logic nghiệp vụ phức tạp. |
| `src/middlewares/` | Chứa các hàm middleware can thiệp vào chu kỳ request-response: kiểm tra token đăng nhập JWT (`verifyToken`), phân quyền truy cập (`checkRole`), kiểm tra dữ liệu đầu vào (`validateRequest`), bắt và chuẩn hóa lỗi toàn cục (`errorHandler`). |
| `src/models/` | Định nghĩa lược đồ dữ liệu (Schema/Entity) và quan hệ giữa các bảng/collection: ví dụ `User.js`, `Product.js`, `Category.js`, `Order.js`, `Cart.js`. |
| `src/routes/` | Quản lý danh sách các đường dẫn API theo từng module (ví dụ: `auth.routes.js`, `product.routes.js`, `order.routes.js`) và gom lại vào route tổng (thường là `/api/v1/...`). |
| `src/services/` | **Tầng cốt lõi của Backend (Business Logic Layer):** Xử lý mọi tính toán, logic mua hàng, áp mã giảm giá, kiểm tra tồn kho, tương tác trực tiếp với tầng `models/` để thêm/sửa/xóa dữ liệu. Tách biệt hoàn toàn khỏi request/response của Express. |
| `src/utils/` | Lưu trữ các hàm tiện ích có thể tái sử dụng khắp ứng dụng: mã hóa mật khẩu (`bcrypt`), sinh mã ngẫu nhiên, định dạng thời gian, class tùy biến lỗi (`ApiError`), hàm bọc async handler (`catchAsync`),... |
| `src/validations/` | Định nghĩa các schema kiểm tra tính hợp lệ của dữ liệu trước khi vào controller (ví dụ: kiểm tra email đúng định dạng, mật khẩu tối thiểu 6 ký tự, giá tiền phải lớn hơn 0,... bằng Joi hoặc Zod). |

---

## 4. Luồng Xử Lý Một Request Điển Hình (Request Lifecycle)

```text
[Client: shop-web]
       │
       ▼ (HTTP Request: e.g. POST /api/v1/orders)
[src/routes]  ─────────► Định tuyến endpoint, gắn middlewares
       │
       ▼ (Qua validationMiddleware & authMiddleware)
[src/middlewares] ─────► Kiểm tra Token JWT & xác thực tính hợp lệ của payload
       │
       ▼ (Nếu hợp lệ, chuyển tiếp tới)
[src/controllers] ─────► Đọc `req.body`, gọi hàm tương ứng trong service
       │
       ▼
[src/services]    ─────► Thực hiện logic nghiệp vụ: trừ tồn kho, tính tổng tiền,...
       │
       ▼
[src/models]      ─────► Truy vấn & lưu dữ liệu vào Database
       │
       ▼
[Client: shop-web] ◄──── Trả về phản hồi JSON qua Controller (res.status(201).json(...))
```

---

## 5. Hướng Dẫn Khởi Chạy Nhanh (Quick Start)

### Cách 1: Khởi chạy toàn bộ hệ thống bằng Docker (Khuyến nghị - 1 Lệnh duy nhất) 🚀

Toàn bộ hệ thống Backend API và Database PostgreSQL được đóng gói hoàn chỉnh bằng Docker Compose với cơ chế tự động khởi tạo database schema và hot-reload khi sửa code.

#### 1. Chuẩn bị file môi trường
```bash
# Trên Linux / macOS:
cp .env.example .env

# Trên Windows (PowerShell):
copy .env.example .env
```

#### 2. Khởi chạy toàn bộ với đúng 1 lệnh
```bash
docker compose up -d --build
```

Sau khi khởi chạy:
- **API Endpoint:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/api/health`
- **PostgreSQL Database:** `localhost:5432` (User: `postgres`, Password: `postgres`, DB: `shop_db`)
- **Hot reload:** Mọi thay đổi trong thư mục `src/` sẽ tự động reload ngay lập tức mà không cần build lại container.

#### Các lệnh Docker hữu ích:
```bash
# Xem log thời gian thực của API
docker compose logs -f api

# Kiểm tra trạng thái các container (và kết quả Healthcheck)
docker compose ps

# Dừng toàn bộ hệ thống
docker compose down

# Dừng và xóa toàn bộ dữ liệu database để khởi tạo lại từ đầu
docker compose down -v
```

---

### Cách 2: Khởi chạy cục bộ trên máy host (Local Node.js & Local PostgreSQL)

Nếu bạn đã có sẵn PostgreSQL 16+ đang chạy trên máy tính cá nhân:

```bash
# 1. Sao chép file môi trường
copy .env.example .env

# 2. Cài đặt thư viện dependencies
npm install

# 3. Khởi chạy môi trường phát triển (tự động reload)
npm run dev

# Hoặc khởi chạy môi trường production:
npm start

# 4. Chạy kiểm thử tự động (Unit / Integration Tests)
npm test
```

---

## 6. Hướng Dẫn Viết Tài Liệu API & Tiêu Chuẩn Dự Án

Dự án áp dụng quy chuẩn RESTful API nghiêm ngặt. Khi phát triển module hoặc feature mới:
1. Đọc kỹ quy ước chung tại: [`docs/API_GUIDELINES.md`](file:///c:/Users/lucas-tran/Documents/Subjects/Year4/HK1-LTW/BTL/shop-api/docs/API_GUIDELINES.md) (Naming convention, mã lỗi HTTP, JWT Header, schema response chuẩn).
2. Sao chép template mẫu tại: [`docs/apis/template.md`](file:///c:/Users/lucas-tran/Documents/Subjects/Year4/HK1-LTW/BTL/shop-api/docs/apis/template.md) sang `docs/apis/<module-name>.md` và điền chi tiết các endpoint kèm lệnh cURL kiểm thử.
3. Kiểm thử API qua bộ collection Bruno đã được chuẩn hóa tại thư mục [`bruno/`](file:///c:/Users/lucas-tran/Documents/Subjects/Year4/HK1-LTW/BTL/shop-api/bruno/).

