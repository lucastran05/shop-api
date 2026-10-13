# SHOP API DOCUMENTATION & TECHNICAL SPECIFICATIONS
> **Thư mục tài liệu kỹ thuật chuẩn của hệ thống Backend Shop API**  
> **Kiến trúc:** Node.js (Express ES Modules) + PostgreSQL 16  
> **Cập nhật:** 2026-10-13  

---

## 1. Cấu Trúc Thư Mục Tài Liệu (`docs/`)

Toàn bộ tài liệu kỹ thuật của dự án được tổ chức khoa học theo mô hình module hóa tại thư mục `docs/`:

```text
docs/
├── README.md                  # Trang tổng quan điều hướng này
├── API_GUIDELINES.md          # Quy chuẩn chung về thiết kế RESTful, HTTP status, Auth & Error Schema
├── bruno-guide.md             # Hướng dẫn kiểm thử API tự động với Bruno Collection
└── apis/                      # Thư mục đặc tả chi tiết 19 phân hệ API (70 endpoints)
    ├── README.md              # Bảng mục lục tra cứu nhanh 19 phân hệ
    ├── template.md            # Template mẫu chuẩn để viết tài liệu endpoint mới
    ├── 01-auth-and-profile.md
    ├── 02-addresses-and-locations.md
    ├── 03-products-catalog.md
    ├── 04-reviews-and-uploads.md
    ├── 05-cart.md
    ├── 06-checkout.md
    ├── 07-payments.md
    ├── 08-orders.md
    ├── 09-chat-and-notifications.md
    ├── 10-shop-info.md
    ├── 11-admin-products.md
    ├── 12-admin-categories.md
    ├── 13-admin-inventory.md
    ├── 14-admin-orders.md
    ├── 15-admin-payments.md
    ├── 16-admin-chat.md
    ├── 17-admin-dashboard-reports.md
    ├── 18-admin-users.md
    └── 19-admin-settings-shop.md
```

---

## 2. Tài Liệu Hướng Dẫn & Quy Chuẩn Cốt Lõi

1. 🧭 [**API Guidelines (Quy Chuẩn Viết API)**](./API_GUIDELINES.md)
   - Quy ước đặt tên URL (`kebab-case`), JSON fields (`snake_case`).
   - Chuẩn HTTP Status Codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 500.
   - Cơ chế bảo mật JWT kép: Access Token (15m), Refresh Token (7d), Refresh Token Rotation (RTR), Token Reuse Detection.
   - Cấu trúc Response Envelope chuẩn: Success, Paginated, và Error Schema có danh sách `errors` chi tiết.
2. 📑 [**Mục Lục Toàn Bộ 19 Phân Hệ API**](./apis/README.md)
   - Bảng tra cứu đầy đủ 70 endpoints (69 REST endpoints + 1 Webhook thanh toán).
3. 📐 [**API Template Chuẩn (template.md)**](./apis/template.md)
   - Template mẫu Markdown bắt buộc sử dụng khi phát triển thêm endpoint mới.
4. 🧪 [**Hướng Dẫn Kiểm Thử Với Bruno (bruno-guide.md)**](./bruno-guide.md)
   - Hướng dẫn nhập Bruno Collection, biến môi trường `{{baseUrl}}` và `{{token}}` tự động lưu khi đăng nhập.

---

## 3. Danh Sách 19 Phân Hệ API Đã Đặc Tả

### Phân Hệ Khách Hàng (Customer & Public)
- [01. Đăng ký, đăng nhập và hồ sơ (AUTH)](./apis/01-auth-and-profile.md)
- [02. Sổ địa chỉ và danh mục địa phương (ADR)](./apis/02-addresses-and-locations.md)
- [03. Danh mục và tìm kiếm sản phẩm (CAT)](./apis/03-products-catalog.md)
- [04. Đánh giá sản phẩm và tải ảnh (REV)](./apis/04-reviews-and-uploads.md)
- [05. Giỏ hàng trực tuyến (CART)](./apis/05-cart.md)
- [06. Báo giá và tạo đơn hàng (CHK)](./apis/06-checkout.md)
- [07. Thanh toán QR và thẻ (PAY)](./apis/07-payments.md)
- [08. Quản lý đơn hàng của khách (ORD)](./apis/08-orders.md)
- [09. Chat hội thoại và thông báo (CHAT & NOT)](./apis/09-chat-and-notifications.md)
- [10. Thông tin cửa hàng (SHOP)](./apis/10-shop-info.md)

### Phân Hệ Quản Trị Hệ Thống (Admin & Management)
- [11. Quản trị sản phẩm và biến thể (ADP)](./apis/11-admin-products.md)
- [12. Quản trị danh mục sản phẩm (ADC)](./apis/12-admin-categories.md)
- [13. Quản lý kho theo biến thể (INV)](./apis/13-admin-inventory.md)
- [14. Quản trị đơn hàng toàn hệ thống (ADO)](./apis/14-admin-orders.md)
- [15. Xác nhận thu tiền và hoàn tiền (ADY)](./apis/15-admin-payments.md)
- [16. Hội thoại quản trị (ADM)](./apis/16-admin-chat.md)
- [17. Dashboard và báo cáo doanh thu (DSH & REP)](./apis/17-admin-dashboard-reports.md)
- [18. Quản trị tài khoản và phân quyền (USR)](./apis/18-admin-users.md)
- [19. Cấu hình cửa hàng quản trị (SET)](./apis/19-admin-settings-shop.md)
