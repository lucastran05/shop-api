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

## 5. Hướng Dẫn Cài Đặt & Chạy Dự Án

### Bước 1: Di chuyển vào thư mục backend
```bash
cd shop-api
```

### Bước 2: Tạo file biến môi trường `.env`
Sao chép cấu hình từ file mẫu `.env.example`:
- Trên Windows (PowerShell):
  ```powershell
  copy .env.example .env
  ```
- Hoặc chỉnh sửa giá trị `PORT`, `DB_URI`, `JWT_SECRET` trong `.env` theo nhu cầu.

### Bước 3: Cài đặt các gói thư viện
```bash
npm install
```

### Bước 4: Khởi chạy server

- **Chế độ phát triển (Development mode - tự động reload khi sửa code):**
  ```bash
  npm run dev
  ```

- **Chế độ chạy chính thức (Production mode):**
  ```bash
  npm start
  ```

Server mặc định sẽ chạy tại: `http://localhost:5000`  
Kiểm tra tình trạng hoạt động của API tại endpoint: `http://localhost:5000/api/health`
