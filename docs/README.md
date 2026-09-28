# Shop API Documentation

Chào mừng bạn đến với thư mục tài liệu kỹ thuật của hệ thống Backend **Shop API**.

---

## Danh Mục Tài Liệu

1. [Tài liệu API Người Dùng (Users API)](./users-api.md)
   - Chi tiết về quy trình Đăng ký, Đăng nhập, Refresh Token, Lấy Profile, Đăng xuất.
   - Định dạng khóa chính **UUID**.
   - Cơ chế cặp token: **Access Token** & **Refresh Token (`rf_token`)**.
   - Chi tiết cấu trúc bảng `users` trong PostgreSQL.
   - Format Request Body, Response Code và các mã lỗi thường gặp.

2. [Hướng dẫn kiểm thử với Bruno](./bruno-guide.md)
   - Cách mở Collection `bruno/` trong ứng dụng Bruno Desktop.
   - Hướng dẫn chọn Environment `Local`.
   - Cơ chế tự động lưu `accessToken` và `refreshToken` qua post-response script.
   - Thứ tự kiểm thử các request trong thư mục **Users**.

---

## Khởi Động Nhanh

1. Khởi động PostgreSQL và cấu hình file `.env`.
2. Chạy server ở chế độ phát triển:
   ```bash
   npm run dev
   ```
3. Mở Bruno và kiểm thử các request trong thư mục **Users**.
