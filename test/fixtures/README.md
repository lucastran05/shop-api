# Dữ liệu kiểm thử Shop

Nguồn schema: `src/config/db.js` (`initDB`), không có ORM hay thư mục migration riêng. Bộ dữ liệu dùng đúng schema hiện tại, bao gồm các cột bổ sung bằng `ALTER TABLE`. Biến thể sản phẩm nằm trong `products.variants` dạng JSONB.

Nguồn quy tắc đã đối chiếu: `src/constants/{roles,locations}.js`, validation đăng nhập, voucher, billing, các controller sản phẩm/địa chỉ/đánh giá và repository đơn hàng/catalog. Script tái sử dụng validator đang có và kiểm tra điều kiện được đánh giá sản phẩm qua repository.

## Chạy

Cần Node.js 22+, Docker đang chạy và dependencies của `shop-api` đã được cài (`npm ci` nếu chưa có). Chạy từ thư mục gốc workspace:

```powershell
cd shop-api
node scripts/seed_test_data.mjs
```

Mỗi lần chạy tạo **một container PostgreSQL 16 mới**, database `shop_qa_fixture`, cổng ngẫu nhiên chỉ bind vào `127.0.0.1`. Container không tham gia network của ứng dụng, không gắn volume ứng dụng và không dùng database production/staging. Script tự tạo mật khẩu PostgreSQL ngẫu nhiên rồi gán URL kết nối trước khi import pool của ứng dụng; giá trị `DATABASE_URL`/`DB_*` có sẵn không quyết định đích seed. Không cần sửa `.env` hoặc Compose hiện tại.

Script in số lượng bản ghi, kết quả kiểm tra, lệnh `docker exec ... psql` để xem dữ liệu và lệnh `docker rm -f ...` để dọn đúng container vừa tạo. Dữ liệu nằm trên tmpfs: **chỉ tồn tại khi container đang chạy**, dừng/xóa container sẽ mất dữ liệu. Có thể chạy lại script để tạo bộ mới độc lập.

Chỉ kiểm tra việc nạp và tự dọn container sau khi xong:

```powershell
node scripts/seed_test_data.mjs --verify
```

Script không nhận URL database hay tùy chọn seed vào database khác. Nếu lỗi nạp/kiểm tra, transaction được rollback và container mới được dọn. Các mật khẩu tài khoản mẫu được sinh ngẫu nhiên và băm bằng helper bcrypt hiện tại, plaintext không được lưu hay in ra. Email dùng miền dành cho kiểm thử `.test`; không sao chép tài khoản thật. Bộ này phục vụ kiểm thử dữ liệu, không cung cấp tài khoản đăng nhập với mật khẩu cố định.

## Bản ghi

| Bảng | Số lượng | Nội dung chính |
|---|---:|---|
| users | 6 | Admin, manager, staff, 3 khách hàng; có khách bị vô hiệu hóa |
| categories | 4 | Tên thông thường, 1 ký tự và 255 ký tự |
| products | 6 | Có hàng, hết hàng, ngừng bán; hỗ trợ cọc 50%/70%, giá biên |
| uploads | 2 | Metadata ảnh; tên file tiếng Việt và dài 255 ký tự |
| user_addresses | 4 | Hai địa chỉ/khách, một mặc định; tỉnh/phường từ danh mục hệ thống |
| shop_settings | 1 | Cửa hàng QA riêng, thông tin liên hệ tùy chọn rỗng |
| vouchers | 6 | Broadcast/selected, %, tiền cố định, miễn phí ship, hết hạn, chưa bắt đầu |
| carts | 3 | Một giỏ có hàng và hai giỏ rỗng |
| cart_items | 2 | Liên kết đúng sản phẩm và ID biến thể |
| orders | 18 | Đủ 10 trạng thái lưu trữ; cọc 50%/70%, COD/QR/thẻ/chuyển khoản, nhận tại cửa hàng |
| order_items | 19 | Một đơn nhiều sản phẩm và giảm giá; đơn có giá 0,01 |
| inventory_adjustments | 2 | Nhập +1 và xuất -1; tồn trước/sau khớp biến thể |
| payment_sessions | 13 | Pending, succeeded, expired, failed; có phiên cọc |
| payment_confirmations | 11 | Đúng số tiền đã thu; người xác nhận có quyền quản lý |
| payments | 11 | Sổ giao dịch mẫu, tham chiếu UUID đơn hàng |
| refunds | 1 | Hoàn tiền toàn bộ, khớp số tiền đã thu |
| reviews | 3 | 1/3/5 sao; nội dung rỗng, tiếng Việt và 1.000 ký tự; khách đủ điều kiện |
| chat_messages | 6 | Hai hội thoại, tin khách/cửa hàng, đã đọc/chưa đọc |
| notifications | 4 | Đã đọc/chưa đọc, liên kết đúng người nhận |
| idempotency_requests | 1 | Khóa dài 200 ký tự, SHA-256 payload và response đơn hàng |
| **Tổng** | **123** | **20 bảng; thêm 6 biến thể nhúng trong JSONB sản phẩm** |

## Các giá trị biên và kiểm tra

- Chuỗi dài tối đa: tên user 100, email 255, tên sản phẩm/danh mục/voucher 255, tên file 255, mã voucher 50, nội dung đánh giá 1.000, mã giao dịch 100, khóa idempotency 200 ký tự. Có tên 1 ký tự, optional `null`/`""`, JSON `[]`/`{}`, dấu nháy, `&`, `< >`, tiếng Việt, Nhật và emoji.
- Giá `0.00`, giá dương nhỏ nhất `0.01`, giá lớn nhất của `NUMERIC(15,2)` là `9999999999999.99`; tồn kho 0, số lượng mua 1, rating 1/5, voucher 0%/100%, usage limit 0/null. Giá cực đại được lưu dạng chuỗi thập phân cho cột NUMERIC.
- Nạp theo thứ tự khóa ngoại trong một transaction; so sánh đủ danh sách bảng với schema thật để tránh bỏ sót khi schema đổi. Đọc lại sau commit để xác nhận dữ liệu đã lưu.
- 12 kiểm tra tính nhất quán: tổng đơn/dòng hàng/sổ thu-hoàn tiền, liên kết payment/địa chỉ mặc định/người nhận voucher/biến thể/chat, tồn kho, thời điểm phiên thanh toán. Các ràng buộc FK của PostgreSQL luôn được bật.
- 12 ca âm chạy trong savepoint rồi rollback: trùng email/danh mục/mã đơn/mã voucher/giỏ của user; FK user không tồn tại; rating 0/6; discount âm/loại sai; tên quá dài; NUMERIC tràn. Không giữ lại bản ghi sai.

Giới hạn: đây là kiểm tra schema, validator và một số điều kiện nghiệp vụ ở tầng dữ liệu; không thay thế kiểm thử HTTP/UI hoặc quy trình giao dịch thật. Upload chỉ là metadata, không tạo file trong object storage; QR/link thanh toán không dẫn đến ngân hàng. Không gửi email/thông báo ra dịch vụ ngoài. Chỉ thêm script/fixture/tài liệu, không sửa mã ứng dụng, migration hoặc nghiệp vụ.
