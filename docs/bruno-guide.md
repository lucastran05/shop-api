# Hướng Dẫn Sử Dụng Bruno HTTP Collection Để Kiểm Thử API

[Bruno](https://www.usebruno.com/) là ứng dụng HTTP Client mã nguồn mở gọn nhẹ, lưu trữ các API request dưới dạng các file văn bản thô `.bru` trực tiếp trong repository.

Bộ sưu tập **Shop API Bruno Collection** đã được cấu hình hoàn chỉnh với đầy đủ 39 request theo cấu trúc chuẩn, hỗ trợ tự động lưu token qua script và kiểm tra assert status code.

---

## 1. Mở Collection Trong Ứng Dụng Bruno

1. Tải và cài đặt ứng dụng [Bruno Desktop](https://www.usebruno.com/downloads) (hỗ trợ Windows, macOS, Linux).
2. Mở ứng dụng **Bruno**.
3. Chọn tính năng **Open Collection**.
4. Chọn đường dẫn tới thư mục `bruno/` trong thư mục gốc dự án `shop-api`:
   ```text
   shop-api/bruno/
   ```
5. Collection **Shop API** sẽ xuất hiện trên thanh điều hướng bên trái với cấu trúc thư mục phân tách theo từng domain:
   - 📁 **Auth** (5 requests)
   - 📁 **Users** (5 requests)
   - 📁 **Products** (7 requests)
   - 📁 **Payments** (7 requests)
   - 📁 **Chat** (8 requests)
   - 📁 **Shop** (4 requests)
   - 📁 **Notifications** (7 requests)
   - 📄 **Health Check** (1 request)

---

## 2. Cấu Hình Môi Trường (Environment Variables)

1. Ở góc trên cùng bên phải giao diện Bruno, mở danh sách thả xuống chọn Environment.
2. Chọn môi trường **`Local`** (được định nghĩa trong `bruno/environments/Local.bru`).
3. Các biến môi trường cốt lõi bao gồm:
   - `baseUrl`: Host chạy server backend (`http://localhost:5000`).
   - `token`: Bearer Access Token hiện tại dùng cho header xác thực `auth:bearer`.
   - `accessToken`: Đồng bộ giá trị với `token`.
   - `refreshToken`: Refresh Token dùng cho endpoint xoay vòng token (`/users/refresh-token`).

> [!TIP]
> **Cơ chế tự động lưu Token:** Khi bạn thực hiện gửi request **Register User** hoặc **Login User**, Bruno sẽ tự động chạy script `post-response` để bóc tách `accessToken` và `refreshToken` từ response và ghi đè vào biến môi trường `token`, `accessToken`, `refreshToken`. Bạn không cần copy-paste token thủ công!

---

## 3. Quy Trình Kiểm Thử Đề Xuất (Testing Workflow)

### Bước 1: Kiểm tra trạng thái máy chủ (Health Check)
- Mở file: `Health Check`
- Bấm **Send**
- Kết quả mong muốn: `HTTP 200 OK`, `status: "success"`, server đang hoạt động bình thường.

### Bước 2: Xác thực & Đăng nhập (Folder `Auth`)
1. **Đăng ký tài khoản:** Mở `Auth / Register User`, bấm **Send** -> `HTTP 201 Created`. Nhận `id` UUID và tự động lưu `token`.
2. **Đăng nhập:** Mở `Auth / Login User`, bấm **Send** -> `HTTP 200 OK`. Cập nhật `token` mới.
3. **Lấy hồ sơ cá nhân:** Mở `Auth / Get Current User (Me)`, bấm **Send** -> `HTTP 200 OK`, xem thông tin user tương ứng với `{{token}}`.
4. **Làm mới Token (RTR):** Mở `Auth / Refresh Token`, bấm **Send** -> `HTTP 200 OK`, cặp token được làm mới và tự động cập nhật vào biến môi trường.

### Bước 3: Quản lý người dùng (Folder `Users`)
1. **Danh sách người dùng:** Mở `Users / Get All Users` (yêu cầu token quyền `admin` hoặc `manager`).
2. **Tạo tài khoản quản trị:** Mở `Users / Create User (Admin)` để tạo nhân viên CSKH hoặc quản lý kho.
3. **Cập nhật người dùng:** Mở `Users / Update User` để kiểm tra cơ chế cập nhật thông tin và chặn leo thang vai trò.

### Bước 4: Kiểm thử sản phẩm & kho hàng (Folder `Products`)
1. **Xem danh mục:** Mở `Products / Get Product Categories` -> `HTTP 200 OK` (Public).
2. **Tìm kiếm & lọc:** Mở `Products / Get All Products`, thử nghiệm các param `category`, `minPrice`, `maxPrice`, `sort`.
3. **Thêm sản phẩm mới:** Mở `Products / Create Product` -> `HTTP 201 Created`.
4. **Cập nhật & Xóa:** Thử nghiệm `Products / Update Product` và `Products / Bulk Delete Products`.

### Bước 5: Kiểm thử thanh toán (Folder `Payments`)
1. **Tạo giao dịch:** Mở `Payments / Create Payment` với mã đơn hàng `ORD-2026-001`.
2. **Tra cứu theo đơn hàng:** Mở `Payments / Get Payments By Order ID`.
3. **Cập nhật trạng thái:** Mở `Payments / Update Payment Status` để chuyển sang `completed`.

### Bước 6: Kiểm thử tin nhắn & chăm sóc khách hàng (Folder `Chat`)
1. **Gửi tin nhắn:** Mở `Chat / Send Message` (khách hàng nhắn cho shop).
2. **Xem hội thoại:** Mở `Chat / Get Conversations` (nhân viên xem tổng hợp các khách hàng).
3. **Đánh dấu đã đọc:** Mở `Chat / Mark Message As Read` hoặc `Chat / Mark All Messages As Read`.

### Bước 7: Cấu hình shop & Thông báo (Folders `Shop` & `Notifications`)
1. **Xem thông tin shop:** Mở `Shop / Get Shop Info` (Public).
2. **Phát thông báo:** Mở `Notifications / Create Notification (Admin)` để phát thông báo khuyến mãi.
3. **Khách hàng nhận thông báo:** Mở `Notifications / Get All Notifications` và `Notifications / Mark All Notifications As Read`.

---

## 4. Cú Pháp Chuẩn Của File `.bru` Trong Bộ Sưu Tập

Tất cả các file đều tuân thủ chặt chẽ cú pháp của Bruno v1:

```bru
meta {
  name: Tên Endpoint
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/api/v1/resource/path
  body: json
  auth: bearer
}

headers {
  Content-Type: application/json
}

auth:bearer {
  token: {{token}}
}

body:json {
  {
    "key": "value"
  }
}

tests {
  test("Status code is 200 OK", function() {
    expect(res.getStatus()).to.equal(200);
    expect(res.getBody().status).to.equal("success");
  });
}
```
