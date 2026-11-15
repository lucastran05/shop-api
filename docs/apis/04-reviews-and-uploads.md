# 04. ĐÁNH GIÁ SẢN PHẨM VÀ TẢI ẢNH (REVIEWS & UPLOADS)
> **Mã phân hệ:** `REV`  
> **Phạm vi:** Khách hàng, Công khai  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Cho phép khách hàng để lại đánh giá, số sao chấm điểm và ảnh đính kèm cho từng sản phẩm:
- **Quy tắc nghiệp vụ:**
  - Điểm đánh giá (`rating`) từ 1 đến 5 sao.
  - Nội dung đánh giá (`content`) tối đa 1000 ký tự.
  - Hỗ trợ tải tối đa 3 ảnh (JPG, PNG, WebP), dung lượng tối đa 2MB mỗi ảnh.
  - Tải file ảnh thực hiện qua endpoint `POST /api/v1/uploads` trước, sau đó truyền danh sách `image_ids` khi gửi đánh giá.
  - Xem danh sách và điểm đánh giá trung bình là công khai (`Public`). Đăng đánh giá và upload ảnh bắt buộc đăng nhập.
  - Chỉ khách đã mua sản phẩm và có đơn ở trạng thái `completed`/`delivered` mới được đánh giá.
  - Mỗi khách chỉ đánh giá một sản phẩm **một lần**. DB có ràng buộc duy nhất `uq_reviews_product_user (product_id, user_id)`.

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/products/:product_id/reviews` và `/api/v1/uploads`
- **Quyền hạn truy cập:**
  - `REV01`: Công khai (`Public`).
  - `REV02`, `REV03`: Khách hàng đăng nhập (`Customer`).

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **REV01** | `GET` | `/api/v1/products/:product_id/reviews` | Public | Lấy danh sách đánh giá và điểm trung bình của sản phẩm |
| **REV02** | `POST` | `/api/v1/products/:product_id/reviews` | Customer | Gửi đánh giá mới cho sản phẩm |
| **REV03** | `POST` | `/api/v1/uploads` | Customer | Tải lên file ảnh đính kèm |

---

## 4. Chi tiết từng Endpoint

### 4.1. REV01 — Xem danh sách đánh giá
- **Method:** `GET`
- **Path:** `/api/v1/products/:product_id/reviews`
- **Query Parameters:** `page=1&limit=5`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "rev-101",
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "author": {
        "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
        "name": "Nguyễn Văn A"
      },
      "rating": 5,
      "content": "Bàn phím gõ rất đầm tay, switch jelly pink êm và mượt. Rất hài lòng!",
      "images": [
        {
          "id": "up-01",
          "url": "https://example.com/uploads/photo1.jpg"
        }
      ],
      "created_at": "2026-10-12T10:00:00.000Z"
    }
  ],
  "summary": {
    "average_rating": 4.8,
    "review_count": 24
  },
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 24,
    "total_pages": 5
  }
}
```

---

### 4.2. REV02 — Gửi đánh giá sản phẩm
- **Method:** `POST`
- **Path:** `/api/v1/products/:product_id/reviews`
- **Headers:** `Authorization: Bearer <token>`

#### Request Body
```json
{
  "rating": 5,
  "content": "Sản phẩm đóng gói cẩn thận, giao hàng nhanh, âm phím rất hay.",
  "image_ids": ["up-01", "up-02"]
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "message": "Gửi đánh giá thành công",
  "data": {
    "id": "rev-102",
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "author": {
      "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
      "name": "Nguyễn Văn A"
    },
    "rating": 5,
    "content": "Sản phẩm đóng gói cẩn thận, giao hàng nhanh, âm phím rất hay.",
    "images": [
      { "id": "up-01", "url": "https://example.com/uploads/photo1.jpg" }
    ],
    "created_at": "2026-10-13T09:00:00.000Z"
  },
  "summary": {
    "average_rating": 4.9,
    "review_count": 25
  }
}
```

---

#### Lỗi nghiệp vụ

| HTTP | `reason` | Khi nào |
|---|---|---|
| 403 | `not_purchased` | Khách chưa mua sản phẩm này |
| 403 | `not_delivered` | Đã mua nhưng đơn chưa giao thành công |
| 409 | `already_reviewed` | Khách đã đánh giá sản phẩm này rồi |

`GET /api/v1/products/:product_id/reviews/eligibility` trả `can_review`, `reason` như trên; với `already_reviewed` có thêm `review_id`.

---

### 4.3. REV03 — Tải file ảnh
- **Method:** `POST`
- **Path:** `/api/v1/uploads`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Form Data:**
  - `files`: File ảnh (tối đa 3 file).
  - `purpose`: `review` (hoặc `product`, `avatar`).

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "up-01",
      "url": "http://localhost:5000/uploads/2026/10/img_keyboard_01.jpg",
      "file_name": "img_keyboard_01.jpg",
      "mime_type": "image/jpeg",
      "size_bytes": 1048576
    }
  ]
}
```

#### Lệnh cURL
```bash
curl -X POST "http://localhost:5000/api/v1/uploads" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "files=@/path/to/image.jpg" \
  -F "purpose=review"
```
