# Hướng Dẫn Sử Dụng Bruno Để Test API

[Bruno](https://www.usebruno.com/) là ứng dụng mã nguồn mở dùng để kiểm thử API lưu trực tiếp các collection dưới dạng file trong thư mục code.

---

## 1. Mở Collection Trong Bruno

1. Tải và cài đặt ứng dụng [Bruno Desktop](https://www.usebruno.com/downloads) (nếu máy bạn chưa có).
2. Mở ứng dụng **Bruno**.
3. Chọn **Open Collection**.
4. Trỏ tới thư mục `bruno/` nằm trong thư mục gốc của dự án `shop-api`:
   ```text
   shop-api/bruno/
   ```
5. Collection **Shop API** sẽ xuất hiện trên thanh điều hướng bên trái của Bruno (với thư mục **Users**).

---

## 2. Chọn Môi Trường (Environment)

1. Ở góc trên bên phải của Bruno, mở danh sách thả xuống chọn Environment.
2. Chọn môi trường **`Local`** (được định nghĩa trong `bruno/environments/Local.bru`):
   - `baseUrl`: `http://localhost:5000/api/v1`
   - `accessToken`: Biến lưu trữ Access Token tự động (hạn 15 phút).
   - `refreshToken`: Biến lưu trữ Refresh Token tự động (hạn 7 ngày).

---

## 3. Thứ Tự Kiểm Thử Đề Xuất (Folder `Users`)

Collection đã được cấu hình post-response script tự động: khi thực hiện **Register** hoặc **Login**, cả `accessToken` và `refreshToken` trả về từ server sẽ được **tự động lưu vào biến môi trường của Bruno**, bạn không cần copy-paste thủ công.

### Bước 1: Kiểm tra trạng thái Server
- Mở request: `Health Check`
- Bấm **Send**
- Kết quả mong muốn: `HTTP 200 OK`, message `Shop API is running smoothly`.

### Bước 2: Đăng ký tài khoản (Register)
- Mở request: `Users/Register User (UUID & rf_token)`
- Kiểm tra thông tin trong tab **Body**:
  ```json
  {
    "name": "Lucas Tran",
    "email": "lucas@example.com",
    "password": "Password123"
  }
  ```
- Bấm **Send**
- Kết quả: `HTTP 201 Created`
- `id` trả về là chuỗi UUID (ví dụ: `e3a7b960-91a5-48b4-a698-32380598b981`).
- `accessToken` và `refreshToken` tự động được gán vào biến môi trường `Local`.

### Bước 3: Đăng nhập (Login)
- Mở request: `Users/Login User`
- Bấm **Send**
- Kết quả: `HTTP 200 OK`, cập nhật cặp token mới và lưu `rf_token` vào database.

### Bước 4: Lấy thông tin người dùng (Get Me)
- Mở request: `Users/Get Current User (Me)`
- Request sử dụng header `Authorization: Bearer {{accessToken}}`.
- Bấm **Send**
- Kết quả: `HTTP 200 OK`, trả về thông tin người dùng kèm ID UUID.

### Bước 5: Làm mới token (Refresh Token)
- Mở request: `Users/Refresh Token (Lấy accessToken mới)`
- Request gửi `refreshToken: {{refreshToken}}`.
- Bấm **Send**
- Kết quả: `HTTP 200 OK`, cấp `accessToken` mới mà không cần đăng nhập lại.

### Bước 6: Đăng xuất (Logout)
- Mở request: `Users/Logout User`
- Bấm **Send**
- Kết quả: `HTTP 200 OK`, xóa `rf_token` khỏi database.
