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

## Hoa bán theo cành và ảnh cành ("Tự tạo bó hoa")

- Đánh dấu hoa bán theo cành bằng công tắc **Bán theo cành** trong form sản phẩm của trang quản trị. Mỗi biến thể là một màu, giá là giá một cành, tồn kho là số cành.
- Kiểu giấy gói và dáng bó khai trong `src/modules/storefront/bouquetStyle.js` và trả cho web qua `GET /api/v1/bouquets/options`. Sửa giá giấy ở đây là mọi nơi đổi theo; phụ phí giấy cộng vào đơn giá dòng bó, dáng bó không ảnh hưởng giá.

- `npm run seed:demo` tạo danh mục "Hoa lẻ theo cành" (`products.sold_by_stem = TRUE`). Trên DB đã có dữ liệu demo, lệnh chỉ bổ sung các sản phẩm cành còn thiếu. Ảnh cành ban đầu là PNG nền trong suốt vẽ sẵn (`scripts/demo-data/stem-art.js`).
- `npm run import:stems` thay ảnh cành bằng ảnh Pexels (`PEXELS_API_KEY`), tách nền bằng remove.bg nếu có `REMOVE_BG_API_KEY`. Tùy chọn: `-- --only=hong-canh-do`, `-- --force`, `-- --dry-run`. Hai key chỉ đặt trong `shop-api/.env`, không dùng tiền tố `VITE_`. Chọn ảnh thủ công bằng `pexels_id` của biến thể trong `scripts/demo-data/catalog.js`.
- Tách nền ảnh hoa ngay trên web: trang quản trị → **Tách nền ảnh** (`/management/cutout`). Chọn ảnh, chỉnh độ nhạy / cọ xóa–giữ, rồi "Lưu làm ảnh cành" cho đúng loại hoa và màu, hoặc tải PNG về máy.
- Ảnh nhóm tự chuẩn bị: `npm run import:stems -- --dir=E:\anh-canh` (thêm `--dry-run` để xem trước). Tên file là mã biến thể (`hong-canh-do.png`, `baby-canh-trang.webp`…). PNG/WebP nền trong suốt dùng cho ảnh xem trước bó hoa; ảnh còn nền chỉ hiện ở danh sách chọn hoa.
- Ảnh gốc và thông tin tác giả lưu ở `variant.stem_photo`; ảnh dùng cho Canvas là `variant.stem_image`; `variant.image` của thẻ sản phẩm không bị ghi đè. Không có remove.bg thì ảnh gốc được đánh dấu `background_removed: false` và Canvas vẫn dùng ảnh vẽ dự phòng.

Docker dùng stage production của Dockerfile, không bind node_modules hoặc source. Thay source thì chạy `docker compose up -d --build --wait` để áp dụng.
