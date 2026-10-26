# Backend sau tái cấu trúc — 26/10/2026

## Luồng xử lý

`routes → middleware → controller → service (nếu có nghiệp vụ) → repository → PostgreSQL`.

Controller định dạng request/response theo API đang được `shop-web/src/shared/api` sử dụng. Service giữ validation và điều phối nghiệp vụ. Repository trong `src/modules` chứa SQL. Các controller có thao tác đơn giản có thể gọi repository trực tiếp; không thêm service chỉ để chuyển tiếp lời gọi.

Đã bỏ sáu model chỉ bọc repository và service sản phẩm không còn người gọi. Giữ các phân hệ identity, catalog, storefront, billing, communication và notification. URL, JWT, vỏ `{status,data}` và các route `/admin`, `/api/v1/admin` được giữ tương thích.

## Giao dịch và dữ liệu

- `src/config/transaction.js` cấp một connection cho BEGIN/COMMIT/ROLLBACK và luôn trả connection về pool.
- Tạo đơn, hủy đơn, cập nhật đơn quản trị, điều chỉnh kho, tạo phiên thanh toán, xác nhận thu tiền và hoàn tiền dùng transaction.
- Các thao tác đọc-sửa đơn/kho dùng `FOR UPDATE`. Sản phẩm khi tạo đơn được khóa theo ID để giảm nguy cơ deadlock.
- Mã `transaction_reference` xác nhận tiền và hoàn tiền được khóa bằng PostgreSQL advisory transaction lock rồi tra trong lịch sử đã lưu. Retry cùng mã/đơn/số tiền trả bản ghi cũ; dùng lại mã với dữ liệu khác trả 409. Không dựa vào bộ nhớ tiến trình để chống ghi tiền hai lần.
- Chỉ đánh dấu đủ cọc khi tiền tích lũy đạt mức cọc của đơn. Số tiền phải hữu hạn, dương và tối đa hai chữ số thập phân; không mặc định số 0 thành toàn bộ số tiền còn lại.
- Khởi tạo schema chạy trong transaction, không DROP/TRUNCATE hoặc reset dữ liệu. Schema `users.id` cũ không phải UUID sẽ bị từ chối để thực hiện migration riêng. Hai index tra mã giao dịch được thêm bằng `IF NOT EXISTS`, không thay đổi bản ghi cũ.
- Báo giá vẫn lưu trong bộ nhớ như kiến trúc cũ, có kiểm tra owner và hết hạn; restart làm mất báo giá. Không phù hợp triển khai nhiều instance khi chưa chuyển cache sang kho dùng chung.

## Quyền truy cập

JWT vẫn được xác minh như trước, sau đó đọc trạng thái và vai trò hiện tại của tài khoản. Tài khoản bị khóa/xóa không dùng được access token cũ; vai trò đã hạ không còn quyền từ token cũ.

Owner hoặc admin/manager được tạo/đọc phiên thanh toán. Customer tạo bản ghi thanh toán cũ phải dùng đơn của mình và chỉ có trạng thái pending; không được tự khai đã thanh toán. Chỉ endpoint xác nhận của staff hoặc webhook đã xác thực mới cập nhật tiền của đơn.

## Hợp đồng webhook

Giữ `POST /api/v1/payments/webhooks/:provider`; bổ sung alias theo tài liệu cũ `POST /api/v1/payments/webhook` (provider mặc định từ `PAYMENT_WEBHOOK_DEFAULT_PROVIDER`, mặc định `vietqr`).

Đây là hợp đồng HMAC giữa một gateway adapter tin cậy và Shop API. Không phải chữ ký nguyên bản của MoMo/VNPay. Một adapter kết nối cổng thật phải xác minh thông báo cổng trước khi ký lại theo hợp đồng này. URL/mã QR hiện còn dữ liệu sandbox kế thừa, chưa phải tích hợp thanh toán thật đã nghiệm thu.

1. Cấu hình `PAYMENT_WEBHOOK_SECRETS` là JSON object, mỗi provider có một secret ngẫu nhiên ít nhất 32 ký tự. `{}` tắt tiếp nhận; provider chưa cấu hình trả 503. Không đưa secret vào `VITE_*` hoặc trình duyệt.
2. `X-Webhook-Timestamp`: Unix seconds dạng chuỗi 10 chữ số, chênh lệch tối đa 300 giây.
3. `X-Signature`: hex HMAC-SHA256 của `timestamp + '.' + rawBody`, có thể thêm tiền tố `sha256=`. So sánh bằng `timingSafeEqual`; mọi thay đổi byte của body sau ký đều làm chữ ký sai.
4. Body phải có `amount`, `transaction_reference` (hoặc alias `transaction_id`) và trạng thái thành công: `PAID`, `succeeded`, `completed` hoặc `success`.
5. Khuyến nghị dùng `payment_id`. Server đối chiếu provider, số tiền, đơn, mục đích, currency và hạn phiên; sau khi thành công cập nhật session thành succeeded để polling hoạt động.
6. Tương thích payload theo đơn: `order_id` (hoặc `orderId`) cùng `currency` là bắt buộc khi không có `payment_id`. Mã giao dịch lưu dạng `provider:reference`, tổng độ dài tối đa 100 ký tự.

Ví dụ body:

```json
{
  "payment_id": "<UUID phiên thanh toán>",
  "transaction_reference": "bank-transaction-123",
  "amount": 200000,
  "status": "PAID",
  "currency": "VND"
}
```

Ví dụ ký ở server adapter Node.js:

```js
const timestamp = String(Math.floor(Date.now() / 1000));
const rawBody = JSON.stringify(body);
const signature = createHmac('sha256', secret)
  .update(timestamp + '.')
  .update(rawBody)
  .digest('hex');
// Gửi chính rawBody cùng X-Signature và X-Webhook-Timestamp.
```

Webhook không chữ ký, sai chữ ký hoặc quá hạn trả 401. Giao dịch thất bại, sai số tiền/currency trả 400; replay xung đột hoặc phiên hết hạn trả 409. Retry hợp lệ không cộng tiền lần thứ hai.

## Kiểm chứng

Các test tích hợp chạy trên database `shop_rewrite_test_<timestamp>` riêng, tạo và xóa bởi runner tạm. Không gọi initDB trên database ứng dụng trong quá trình kiểm thử. Báo cáo tại thư mục gốc workspace ghi số ca, kết quả, phạm vi và giới hạn. Mã test và runner tạm được xóa sau nghiệm thu theo yêu cầu người dùng.
