# ABC Shop — backend

Express.js, PostgreSQL, JWT và MinIO SDK. Controller gọi service khi cần điều phối/validation; repository và policy trong `src/modules` chứa truy cập dữ liệu và quy tắc nghiệp vụ. Không có model chuyển tiếp.

## Chạy toàn bộ BTL

Compose duy nhất nằm tại `BTL/compose.yaml`. Tạo `BTL/.env` từ mẫu ở BTL rồi cấu hình mật khẩu/secret riêng. Với database có sẵn, dùng đúng thông tin kết nối hiện tại.

```powershell
docker compose up -d --build --wait
docker compose ps
```

Lệnh cũng chạy được từ `shop-api` vì Compose tự tìm cấu hình ở thư mục cha. Backend: http://localhost:5000/api/health; frontend: http://localhost:8080; MinIO Console: http://localhost:9001.

PostgreSQL dùng lại volume `shop_pgdata`. MinIO dùng `shop_minio_data`. Backend tạo schema bổ sung trong transaction, không tự xóa bảng/dữ liệu cũ.

## Chạy Node trực tiếp

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

`.env` riêng trong shop-api chỉ dành cho chạy Node trực tiếp; Docker dùng `.env` tại BTL. Đặt DB_HOST/DB_PORT tới PostgreSQL cần dùng. Chọn `UPLOAD_STORAGE=local` khi chưa chạy MinIO; hoặc cấu hình MINIO_ENDPOINT/PORT/ACCESS_KEY/SECRET_KEY và chọn `minio`. Với backend chạy trực tiếp, MinIO Docker ở localhost:9000.

## Source

Đọc source theo luồng của một request: **route** nhận URL → **middleware** kiểm tra quyền → **controller** đọc input và trả response → **service** điều phối nghiệp vụ khi cần → **repository** đọc/ghi PostgreSQL. Các lớp nằm trong `src/`; service không bắt buộc nếu controller có thể gọi repository trực tiếp.

```text
src/
├── app.js                  # Middleware, routers, public image streaming
├── server.js               # Khởi tạo DB + bucket rồi listen
├── config/                 # Pool, schema, transaction helper
├── routes/                 # Customer, staff và alias API
├── controllers/            # HTTP input/output
├── services/               # Auth, user, shop, chat, notification, payment, upload storage
├── modules/                # Identity, catalog, storefront, billing, communication, notification
├── middlewares/            # JWT/RBAC, rate limit, multipart, webhook
├── common/                 # Lỗi, response, logging và interface dùng chung
├── constants/              # Hằng số và dữ liệu địa giới
├── utils/                  # JWT và mật khẩu
└── validations/            # Kiểm tra input
```

Khi tìm một API, bắt đầu từ `src/app.js` và `src/routes/index.js`, rồi lần theo route đến controller và repository liên quan. Không cần đọc toàn bộ dự án trước khi sửa một tính năng.

## Hợp đồng và storage

- `/api/v1`: auth, profile, catalog, cart, checkout, orders, chat, notification, upload.
- `/admin` và `/api/v1/admin`: các endpoint quản trị hiện có.
- `/uploads/<UUID>.<ext>`: stream ảnh từ MinIO, fallback file local cũ khi không có object.
- Bucket private được tạo ở startup; browser chỉ upload qua API có JWT. Lô upload dùng transaction metadata và dọn object nếu thất bại.
- `PUBLIC_API_URL` để trống trả URL ảnh tương đối cùng origin; chỉ đặt khi thật sự có public origin riêng cho ảnh.

Xem [kiến trúc và thanh toán](docs/backend-architecture.md), [tài liệu API](docs/apis/README.md), [MinIO trong BTL](../shop-web/MINIO.md) và [quy ước viết API](docs/API_GUIDELINES.md).

Docker dùng stage production của Dockerfile, không bind node_modules hoặc source. Thay source thì chạy `docker compose up -d --build --wait` để áp dụng.
