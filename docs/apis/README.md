# TỔNG QUAN TÀI LIỆU API SHOP (API DOCUMENTATION INDEX)
> **Tài liệu tổng hợp danh mục phân hệ API dự án ABC Shop**  
> **Kiến trúc:** RESTful API chuẩn Express.js (ES Modules)  
> **Cập nhật:** 2026-10-13  

---

## 1. Hướng dẫn & Quy chuẩn chung
Trước khi lập trình hoặc tích hợp API, các thành viên bắt buộc đọc qua các tài liệu nền tảng sau:
- 📖 [**Quy chuẩn viết và thiết kế API (API GUIDELINES)**](../API_GUIDELINES.md)
- 📝 [**Template mẫu viết tài liệu API (Template Markdown)**](./template.md)
- 🧪 [**Hướng dẫn kiểm thử tự động với Bruno**](../bruno-guide.md)

---

## 2. Danh mục tài liệu theo Phân hệ (19 Phân hệ)

### Nhóm Khách Hàng (Customer & Public Endpoints)
| STT | Phân hệ API | Mã module | File tài liệu | Số endpoint |
| :---: | :--- | :---: | :--- | :---: |
| 1 | Đăng ký, đăng nhập và hồ sơ cá nhân | `AUTH` | [`01-auth-and-profile.md`](./01-auth-and-profile.md) | 6 |
| 2 | Sổ địa chỉ và danh mục địa phương | `ADR` | [`02-addresses-and-locations.md`](./02-addresses-and-locations.md) | 7 |
| 3 | Danh mục và tìm kiếm sản phẩm | `CAT` | [`03-products-catalog.md`](./03-products-catalog.md) | 3 |
| 4 | Đánh giá sản phẩm và tải ảnh khách | `REV` | [`04-reviews-and-uploads.md`](./04-reviews-and-uploads.md) | 3 |
| 5 | Giỏ hàng trực tuyến | `CART` | [`05-cart.md`](./05-cart.md) | 4 |
| 6 | Báo giá và tạo đơn hàng | `CHK` | [`06-checkout.md`](./06-checkout.md) | 2 |
| 7 | Phiên thanh toán QR và thẻ | `PAY` / `SYS` | [`07-payments.md`](./07-payments.md) | 3 |
| 8 | Quản lý đơn hàng của khách | `ORD` | [`08-orders.md`](./08-orders.md) | 3 |
| 9 | Chat hội thoại và thông báo | `CHAT` / `NOT` | [`09-chat-and-notifications.md`](./09-chat-and-notifications.md) | 6 |
| 10 | Thông tin công khai của cửa hàng | `SHOP` | [`10-shop-info.md`](./10-shop-info.md) | 1 |

---

### Nhóm Quản Trị Hệ Thống (Admin & Management Endpoints)
| STT | Phân hệ API | Mã module | File tài liệu | Số endpoint |
| :---: | :--- | :---: | :--- | :---: |
| 11 | Quản trị sản phẩm và biến thể | `ADP` | [`11-admin-products.md`](./11-admin-products.md) | 7 |
| 12 | Quản trị danh mục sản phẩm | `ADC` | [`12-admin-categories.md`](./12-admin-categories.md) | 5 |
| 13 | Quản lý kho theo biến thể | `INV` | [`13-admin-inventory.md`](./13-admin-inventory.md) | 3 |
| 14 | Quản trị đơn hàng toàn hệ thống | `ADO` | [`14-admin-orders.md`](./14-admin-orders.md) | 3 |
| 15 | Xác nhận thu tiền và hoàn tiền | `ADY` | [`15-admin-payments.md`](./15-admin-payments.md) | 2 |
| 16 | Quản lý hội thoại và chăm sóc khách | `ADM` | [`16-admin-chat.md`](./16-admin-chat.md) | 3 |
| 17 | Dashboard và báo cáo doanh thu | `DSH` / `REP` | [`17-admin-dashboard-reports.md`](./17-admin-dashboard-reports.md) | 2 |
| 18 | Quản trị tài khoản và phân quyền | `USR` | [`18-admin-users.md`](./18-admin-users.md) | 5 |
| 19 | Cấu hình thông tin cửa hàng | `SET` | [`19-admin-settings-shop.md`](./19-admin-settings-shop.md) | 2 |

**Tổng cộng:** **70 endpoints** (bao gồm 69 API endpoints + 1 Webhook thanh toán).
