# Bloomora API

Backend Node.js/Express dùng PostgreSQL để lưu tài khoản, sản phẩm, giỏ hàng, đơn hàng và dữ liệu quản lý. JWT dùng cho xác thực; ảnh có thể lưu trong MinIO hoặc thư mục local. Hướng dẫn chạy cả hệ thống nằm ở [README thư mục gốc](../README.md).

## Chạy backend

**Docker:** tại thư mục gốc, chuẩn bị `.env` theo `.env.example`, rồi chạy `docker compose up -d --build --wait`. Compose chờ PostgreSQL và MinIO healthy trước khi khởi động API.

**Node trực tiếp:** dùng PowerShell trong `shop-api`:

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run dev
```

Chỉnh `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` và hai JWT secret trong `shop-api/.env`. PostgreSQL của Compose mở ở `localhost:5433` từ máy host, nên đặt `DB_PORT=5433` nếu dùng nó. Với MinIO Docker, dùng `MINIO_ENDPOINT=localhost`, `MINIO_PORT=9000` và credential từ `.env` gốc; hoặc đặt `UPLOAD_STORAGE=local`. Mailpit Docker nhận SMTP tại `127.0.0.1:1025`. API health: http://localhost:5000/api/health.

## Cấu trúc source

```text
shop-api/
├── src/
│   ├── server.js            # Khởi tạo DB, storage, HTTP server và chat socket
│   ├── app.js               # Middleware, /api/v1, /admin, upload, health, lỗi
│   ├── routes/              # Gắn URL và HTTP method với controller
│   ├── controllers/         # Nhận request, gọi nghiệp vụ, trả response
│   ├── services/            # Auth, email, chat, thanh toán, nhận diện hoa, storage
│   ├── modules/             # Repository, policy và quy tắc nghiệp vụ theo domain
│   ├── config/              # PostgreSQL pool, khởi tạo schema, transaction
│   ├── middlewares/         # JWT/RBAC, rate limit, upload, xác thực webhook
│   ├── common/              # Error handler, helper và interface dùng chung
│   ├── constants/data/      # Danh mục địa giới Việt Nam và giấy phép nguồn
│   ├── utils/               # JWT và mật khẩu
│   └── validations/         # Kiểm tra dữ liệu đầu vào
├── bruno/                   # Request API để thử bằng Bruno
├── scripts/                 # Tạo và kiểm tra dữ liệu demo
├── Dockerfile               # Image Node production
└── .env.example             # Mẫu môi trường khi chạy Node trực tiếp
```

Một request thông thường đi từ `src/app.js` đến `src/routes/index.js` hoặc `admin.routes.js`, qua middleware xác thực nếu cần, rồi đến controller, service/repository và PostgreSQL. Khi sửa một endpoint, tìm đường dẫn ở `routes/` trước rồi lần theo controller liên quan. `src/modules/` chia thành `identity`, `catalog`, `storefront`, `billing`, `communication`, `notification` và `flower`.

## API và cách thử

| Prefix | Nội dung chính |
| --- | --- |
| `/api/v1/auth`, `/api/v1/me`, `/api/v1/users` | Đăng nhập, hồ sơ, tài khoản |
| `/api/v1/locations`, `/api/v1/categories`, `/api/v1/products` | Địa chỉ, danh mục, catalog, review |
| `/api/v1/cart`, `/api/v1/checkout`, `/api/v1/orders` | Giỏ hàng, báo giá, đơn hàng |
| `/api/v1/payments`, `/api/v1/vouchers` | Thanh toán, mã giảm giá |
| `/api/v1/conversations`, `/api/v1/chat`, `/api/v1/notifications` | Chat và thông báo |
| `/api/v1/flowers` | Nhận diện hoa và lịch sử cá nhân |
| `/admin` và `/api/v1/admin` | Sản phẩm, kho, đơn, thanh toán, người dùng, báo cáo, cài đặt |

Mở thư mục `bruno/` trong Bruno, chọn environment `Local` và đặt `baseUrl=http://localhost:5000`. Chạy request đăng nhập để lấy token, sau đó thử nhóm `Customer/` hoặc `Admin/`. Route và file `.bru` là chỗ tra HTTP method, body và response khi sửa tính năng. API quản trị yêu cầu JWT và vai trò `admin` hoặc `manager`; một số thao tác tài khoản chỉ dành cho `admin`.

## Storage và vận hành

- Upload ảnh qua API có JWT. Bucket MinIO là private; browser nhận URL `/uploads/...` do API phục vụ. Ảnh review tối đa 2 MB, product/avatar tối đa 10 MB, tối đa 3 ảnh mỗi request.
- Email quên mật khẩu đi tới Mailpit trong cấu hình local. Chuyển sang SMTP thật cần cấu hình `SMTP_*`, `MAIL_FROM` và `PASSWORD_RESET_URL` ở backend.
- `PAYMENT_WEBHOOK_SECRETS={}` chưa cấu hình gateway. Webhook yêu cầu secret và chữ ký HMAC hợp lệ; không đưa secret vào frontend. Việc ghi nhận thanh toán thủ công trong quản lý là một luồng riêng.
- `npm.cmd run seed:demo` tạo dữ liệu mẫu; `npm.cmd run seed:check` kiểm tra dữ liệu đó. Chỉ chạy seed trên database phù hợp.

## Nguồn dữ liệu địa giới

`src/constants/data/locations.json` lấy từ [vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database/tree/8b78ba5118715e1fa81769286724db79346abf52/json), file `json/vn_only_simplified_json_generated_data_vn_units.json`, commit `8b78ba5118715e1fa81769286724db79346abf52` (31/10/2026). Giấy phép MIT được giữ ở `src/constants/data/LICENSE`. Bản hiện tại có 34 tỉnh/thành và 3.321 xã/phường/đặc khu. Các trường `Code`, `FullName`, `ProvinceCode` đổi thành `code`, `name`, `province_code`; `Wards` làm phẳng thành `wards`. Khi cập nhật, kiểm tra mã duy nhất và quan hệ tỉnh/xã; danh mục mới không tự cập nhật địa chỉ đã lưu.

## Discovery

API /api/v1/discovery phục vụ trang /kham-pha. Cấu hình GEMINI_API_KEY và tùy chọn GROQ_API_KEY trong .env gốc khi chạy Docker Compose. Các model có thể đổi qua DISCOVERY_GEMINI_MODEL và DISCOVERY_GROQ_MODEL; Cohere chỉ dùng cho đánh giá khi bật DISCOVERY_EVALUATE_COHERE. Xem docs/discovery/README.md để biết endpoint và cách kiểm tra.

## Hoa bán theo cành

Sản phẩm có thể bật **Bán theo cành**, với mỗi biến thể là một màu, giá và tồn kho theo số cành. Kiểu giấy gói và dáng bó nằm ở `src/modules/storefront/bouquetStyle.js`, được trả qua `GET /api/v1/bouquets/options`. Lệnh `npm run seed:demo` thêm hoa cành mẫu; `npm run import:stems` nhập ảnh cành từ Pexels hoặc thư mục ảnh của nhóm. Xem `npm run import:stems -- --help` để biết tùy chọn.

Docker dùng stage production của Dockerfile. Sau khi thay source, chạy `docker compose up -d --build --wait` ở repo tổng.
