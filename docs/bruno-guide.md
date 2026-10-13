# Hướng Dẫn Sử Dụng Bruno HTTP Collection Cho ABC Shop API

[Bruno](https://www.usebruno.com/) là ứng dụng HTTP Client mã nguồn mở gọn nhẹ, lưu trữ toàn bộ các API request dưới dạng các file văn bản thô `.bru` trực tiếp trong repository.

Bộ sưu tập **Shop API Bruno Collection** (`shop-api/bruno/`) đã được hoàn thiện với cấu trúc chuẩn theo hợp đồng đặc tả `Danh_sach_API_ABC_Shop.md`:
- Hỗ trợ đầy đủ luồng nghiệp vụ **Khách hàng (`/api/v1/...`)** và **Quản trị viên (`/admin/...`)**.
- Tích hợp sẵn `script:post-response` tự động lưu token, id sản phẩm, đơn hàng, giỏ hàng, phiên thanh toán vào biến môi trường.
- Tích hợp sẵn khối `tests` kiểm tra status code và schema JSON.

---

## 1. Mở Collection Trong Bruno

1. Tải và cài đặt ứng dụng [Bruno Desktop](https://www.usebruno.com/downloads) (Windows, macOS, Linux).
2. Khởi chạy **Bruno**.
3. Chọn tính năng **Open Collection**.
4. Chọn đường dẫn tới thư mục `bruno/` trong dự án `shop-api`:
   ```text
   shop-api/bruno/
   ```
5. Collection **Shop API** sẽ xuất hiện trên thanh điều hướng bên trái với cấu trúc thư mục rõ ràng:

### 📁 Nhánh Khách hàng (`Customer/`):
- `01-Auth`: `AUTH01 - Register Customer`, `AUTH02 - Login Customer`, `AUTH03 - Logout Customer`.
- `02-Profile-Addresses`: `AUTH04 - Get Profile Me`, `AUTH05 - Update Profile Me`, `AUTH06 - Update Password Me`, `ADR01` đến `ADR07` (Quản lý địa chỉ giao hàng và danh sách tỉnh/xã).
- `03-Catalog-Reviews`: `CAT01` (Danh sách sản phẩm), `CAT02` (Chi tiết), `CAT03` (Danh mục), `REV01 - REV03` (Đánh giá và upload ảnh).
- `04-Cart`: `CART01` (Xem giỏ), `CART02` (Thêm món).
- `05-Checkout-Orders`: `CHK01` (Báo giá và cọc), `CHK02` (Tạo đơn hàng), `ORD01 - ORD03` (Lịch sử đơn, chi tiết, hủy đơn).
- `06-Payments`: `PAY01` (Tạo phiên VietQR), `PAY02` (Theo dõi thanh toán), `SYS01` (Webhook cổng thanh toán).
- `07-Chat`: `CHAT01` (Mở chat), `CHAT02` (Lịch sử tin nhắn), `CHAT03` (Gửi tin nhắn).
- `08-Notifications`: `NOT01` (Danh sách thông báo), `NOT02` (Đánh dấu 1 tin đã đọc), `NOT03` (Đọc tất cả).
- `09-Shop`: `SHOP01` (Thông tin liên hệ, hình thức shop).

### 📁 Nhánh Quản trị viên (`Admin/`):
- `01-Dashboard-Reports`: `DSH01` (Số liệu tổng quan, doanh thu, đơn gần đây), `REP01` (Báo cáo bán hàng theo tháng/năm).
- `02-Products`: `ADP01` (Danh sách quản trị), `ADP02` (Chi tiết), `ADP03` (Thêm sản phẩm kèm biến thể & cọc), `ADP04` (Sửa/ghim), `ADP05 - ADP06` (Xóa đơn/xóa nhiều).
- `03-Categories`: `ADC01 - ADC05` (Danh mục, thêm mới, sửa tên, xóa nhiều).
- `04-Inventory`: `INV01` (Tồn kho theo biến thể), `INV02` (Điều chỉnh tồn thủ công), `INV03` (Lịch sử điều chỉnh).
- `05-Orders-Payments`: `ADO01 - ADO03` (Tìm kiếm, xem chi tiết, đổi trạng thái và mã vận đơn), `ADY01 - ADY02` (Xác nhận cọc/thu đủ và hoàn tiền).
- `06-Chat`: `ADM01 - ADM03` (Danh sách khách hàng chat, nạp tin nhắn, nhân viên trả lời).
- `07-Settings`: `SET01 - SET02` (Xem và lưu cấu hình shop).
- `08-Users`: `USR01 - USR05` (Quản trị viên quản lý danh sách, tạo tài khoản, đổi vai trò, khóa và xóa tài khoản - bảo vệ tài khoản admin không bị xóa).

---

## 2. Cấu Hình Biến Môi Trường (`Local.bru`)

Trong góc trên cùng bên phải Bruno, chọn môi trường **`Local`** (`bruno/environments/Local.bru`).

Các biến môi trường chính:
- `baseUrl`: `http://localhost:5000` (hoặc cổng mà server đang chạy).
- `token` / `accessToken`: Access Token hiện tại của tài khoản khách hàng.
- `adminToken`: Access Token của tài khoản có vai trò `admin` hoặc `manager`.
- `productId`, `orderId`, `quoteId`, `addressId`, `conversationId`, `userId`: Tự động được bắt và lưu khi gửi các request tạo dữ liệu.

---

## 3. Quy Trình Kiểm Thử Đề Xuất (End-to-End Workflow)

1. **Khởi động server:**
   ```bash
   npm run dev
   ```
2. **Khách hàng đăng ký & đăng nhập:**
   - Mở `Customer / 01-Auth / AUTH01 - Register Customer` -> Bấm **Send** -> Nhận `201 Created` (Token tự động gán vào biến môi trường).
   - Mở `Customer / 02-Profile-Addresses / ADR02 - Create Customer Address` -> Bấm **Send** -> Nhận `201 Created` (Lưu `addressId`).
3. **Xem sản phẩm & đặt hàng:**
   - Mở `Customer / 03-Catalog-Reviews / CAT01 - Get Products Customer` -> Bấm **Send** (Lưu `productId`).
   - Mở `Customer / 04-Cart / CART02 - Add Item To Cart` -> Bấm **Send** -> Nhận `200 OK`.
   - Mở `Customer / 05-Checkout-Orders / CHK01 - Calculate Quote` -> Bấm **Send** -> Nhận báo giá kèm tiền cọc (Lưu `quoteId`).
   - Mở `Customer / 05-Checkout-Orders / CHK02 - Create Order` -> Bấm **Send** -> Tạo đơn hàng thành công (Lưu `orderId`).
4. **Thanh toán & Cọc:**
   - Mở `Customer / 06-Payments / PAY01 - Create Payment Session` -> Bấm **Send** -> Nhận link QR VietQR thanh toán cọc.
5. **Quản trị viên xử lý đơn & kho:**
   - Đăng nhập tài khoản admin để lấy `adminToken`.
   - Mở `Admin / 05-Orders-Payments / ADY01 - Confirm Payment Admin` -> Bấm **Send** -> Trạng thái cọc chuyển sang `paid`.
   - Mở `Admin / 05-Orders-Payments / ADO03 - Update Admin Order Status` -> Bấm **Send** -> Cập nhật trạng thái `processing`, đơn vị giao vận và mã tracking.
   - Mở `Admin / 01-Dashboard-Reports / DSH01 - Get Dashboard Summary` -> Bấm **Send** -> Xem doanh thu và số lượng đơn hàng cập nhật thời gian thực.
