# 05. GIỎ HÀNG (SHOPPING CART)
> **Mã phân hệ:** `CART`  
> **Phạm vi:** Khách hàng đăng nhập  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý giỏ hàng của khách hàng, kiểm tra tính khả dụng của biến thể sản phẩm và tính toán tạm tính:
- **Quy tắc nghiệp vụ:**
  - Định danh sản phẩm trong giỏ kết hợp cả `product_id` và `variant_id`.
  - Khi thêm sản phẩm đã tồn tại trong giỏ với cùng biến thể, hệ thống tự động cộng dồn số lượng.
  - Số lượng trong giỏ không được vượt quá số lượng tồn kho khả dụng (`stock_quantity`).
  - Phản hồi luôn tính sẵn `line_count` (số mặt hàng khác nhau), `item_count` (tổng số lượng sản phẩm), và `subtotal` (tổng tiền toàn bộ giỏ).
  - **Bó hoa tự tạo (`CART05`):** khách ghép hoa bán theo cành (`products.sold_by_stem = true`; mỗi biến thể là một màu, `price` là giá một cành, `stock_quantity` là số cành). Dòng giỏ có `item_type = "custom_bouquet"`, `product_id = null`, `variant_id = "custom:<hash thành phần>"` và `components`. Cùng thành phần thì cộng `quantity`, khác thành phần thì là dòng riêng. Giá bó luôn tính lại khi đọc giỏ: `unit_price = Σ(stems × giá cành hiện tại)`. Dòng sản phẩm thường có `item_type = "product"`.

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/cart`
- **Quyền hạn truy cập:** Khách hàng đã đăng nhập (`Customer`).
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **CART01** | `GET` | `/api/v1/cart` | Customer | Lấy thông tin giỏ hàng và số lượng badge ở Header |
| **CART02** | `POST` | `/api/v1/cart/items` | Customer | Thêm một biến thể sản phẩm vào giỏ hàng |
| **CART03** | `PATCH` | `/api/v1/cart/items/:item_id` | Customer | Điều chỉnh số lượng sản phẩm trong dòng giỏ hàng |
| **CART04** | `DELETE` | `/api/v1/cart/items/:item_id` | Customer | Xóa một dòng sản phẩm khỏi giỏ hàng |
| **CART05** | `POST` | `/api/v1/cart/bouquets` | Customer | Thêm bó hoa tự tạo từ hoa bán theo cành |
| **CART06** | `GET` | `/api/v1/bouquets/options` | Guest | Danh sách kiểu giấy gói và dáng bó |

---

## 4. Chi tiết từng Endpoint

### 4.1. CART01 — Lấy giỏ hàng
- **Method:** `GET`
- **Path:** `/api/v1/cart`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "cart-987123",
    "line_count": 1,
    "item_count": 2,
    "subtotal": 3380000,
    "currency": "VND",
    "updated_at": "2026-10-13T09:10:00.000Z",
    "items": [
      {
        "id": "item-01",
        "product_id": "550e8400-e29b-41d4-a716-446655440000",
        "variant_id": "var-01",
        "product_name": "Bàn phím cơ không dây AKKO 3084B Plus",
        "variant_label": "CS Jelly Pink Switch",
        "color": "Hồng / Trắng",
        "image_url": "https://images.unsplash.com/photo-example-1.jpg",
        "unit_price": 1690000,
        "quantity": 2,
        "stock_quantity": 15,
        "line_total": 3380000,
        "is_available": true
      }
    ]
  }
}
```

---

### 4.2. CART02 — Thêm sản phẩm vào giỏ
- **Method:** `POST`
- **Path:** `/api/v1/cart/items`

#### Request Body
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "variant_id": "var-01",
  "quantity": 1
}
```

#### Responses Mẫu
- **`200 OK`**: Trả về cấu trúc giỏ hàng mới nhất đã cập nhật.
- **`400 Bad Request`**: Số lượng vượt quá tồn kho khả dụng.
```json
{
  "status": "error",
  "message": "Số lượng yêu cầu vượt quá tồn kho khả dụng",
  "code": "INSUFFICIENT_STOCK"
}
```

---

### 4.3. CART03 — Sửa số lượng sản phẩm
- **Method:** `PATCH`
- **Path:** `/api/v1/cart/items/:item_id`

#### Request Body
```json
{
  "quantity": 3
}
```

#### Responses Mẫu
- **`200 OK`**: Trả về dữ liệu giỏ hàng mới nhất.

---

### 4.4. CART04 — Xóa sản phẩm khỏi giỏ
- **Method:** `DELETE`
- **Path:** `/api/v1/cart/items/:item_id`

#### Responses Mẫu
- **`200 OK`**: Trả về dữ liệu giỏ hàng sau khi loại bỏ sản phẩm.

#### Lệnh cURL
```bash
curl -X DELETE "http://localhost:5000/api/v1/cart/items/item-01" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 4.5. CART05 — Thêm bó hoa tự tạo
- **Method:** `POST`
- **Path:** `/api/v1/cart/bouquets`
- Lấy danh sách hoa bán theo cành bằng `GET /api/v1/products?sold_by_stem=true`, rồi `GET /api/v1/products/:id` để có biến thể (màu, giá cành, tồn, `stem_image`, `stem_photo`).

#### Request Body
Backend chỉ đọc `items[].product_id`, `items[].variant_id`, `items[].stems`, `quantity`, `wrap` và `height`. Mọi trường giá (`price`, `unit_price`, `line_total`...) bị bỏ qua.
```json
{
  "items": [
    { "product_id": "45e1282f-1ec3-4614-b845-c361574e57d8", "variant_id": "hong-canh-do", "stems": 3, "stem_length": 65 },
    { "product_id": "55cd0410-7b4a-472a-b097-2905074f0403", "variant_id": "baby-canh-trang", "stems": 2, "stem_length": 40 }
  ],
  "quantity": 1,
  "wrap": "silk",
  "height": "tall"
}
```

| Trường | Bắt buộc | Quy tắc |
| :--- | :---: | :--- |
| `items` | Có | Mảng không rỗng. Dòng trùng `product_id` + `variant_id` được cộng số cành. Tổng tối đa 200 cành/bó. |
| `items[].product_id` | Có | UUID của sản phẩm `active = true` và `sold_by_stem = true`. |
| `items[].variant_id` | Có | Id biến thể (màu) của sản phẩm đó. |
| `items[].stems` | Có | Số nguyên dương kiểu number (không nhận `0`, số âm, số thập phân, chuỗi). |
| `items[].stem_length` | Không | Chiều dài cành muốn cắt cho **riêng loại hoa đó** (cm): số nguyên 40–70, cách nhau 5, mặc định 50. Không ảnh hưởng giá. |
| `quantity` | Không | Số bó, số nguyên 1–50, mặc định 1. |
| `wrap` | Không | Mã giấy gói lấy từ `CART06`, mặc định `kraft`. Phụ phí cộng vào `unit_price` của dòng bó. |
| `height` | Không | Dáng bó lấy từ `CART06` (`low`, `medium`, `tall`), mặc định `medium`. Không ảnh hưởng giá. |

#### Responses Mẫu
- **`200 OK`**: Trả về giỏ hàng mới nhất. Dòng bó có dạng:
```json
{
  "id": "1d0c5d8e-6a51-4c34-9a0a-5b1f0b6f3c11",
  "item_type": "custom_bouquet",
  "product_id": null,
  "variant_id": "custom:08568a573e2c6e526961938893701ddd",
  "product_name": "Bó hoa tự chọn",
  "variant_label": "3 Hoa hồng cành Đỏ · 2 Hoa baby cành Trắng",
  "color": "",
  "image_url": "http://localhost:5000/uploads/<ảnh cành>.png",
  "allow_deposit": false,
  "deposit_rate": 20,
  "unit_price": 80000,
  "quantity": 1,
  "stock_quantity": 66,
  "line_total": 80000,
  "is_available": true,
  "components": [
    {
      "product_id": "45e1282f-1ec3-4614-b845-c361574e57d8",
      "variant_id": "hong-canh-do",
      "product_name": "Hoa hồng cành",
      "variant_label": "1 cành",
      "color": "Đỏ",
      "stems": 3,
      "stem_length": 65,
      "unit_price": 20000,
      "line_total": 60000,
      "image_url": "http://localhost:5000/uploads/<ảnh cành>.png",
      "stem_image": "http://localhost:5000/uploads/<ảnh cành>.png",
      "stock_quantity": 200,
      "is_available": true
    }
  ]
}
```
  `stock_quantity` của dòng bó là số bó tối đa có thể làm với tồn hiện tại (min theo từng loại cành). `is_available = false` khi một loại hoa đã ngừng bán, bị xóa hoặc không đủ cành.
- **`400 Bad Request`**: bó rỗng, `product_id`/`variant_id` sai định dạng, `stems`/`quantity` không hợp lệ, sản phẩm không bán theo cành.
- **`404 Not Found`**: `product_id` hoặc `variant_id` không tồn tại.
- **`409 Conflict`**: hoa đã ngừng bán, hoặc tồn kho cành không đủ cho tổng số bó trong dòng giỏ (bó cũ + bó mới).
```json
{
  "status": "error",
  "message": "Hoa baby cành Trắng chỉ còn 20 cành, không đủ 22 cành cho bó hoa"
}
```

#### Báo giá, đặt hàng và hủy đơn với dòng bó
- `CHK01` nhận `cart_item_ids` chứa id dòng bó như dòng thường; kiểm tra lại tồn và cộng nhu cầu cành của mọi dòng (hai bó cùng dùng hồng đỏ được tính chung).
- `CHK02` lưu `order_items` với `item_type = "custom_bouquet"`, `product_id = null` và `components` (ảnh chụp tên hoa, màu, số cành, giá cành lúc đặt). Tồn kho được trừ theo từng biến thể cành (`stems × quantity`) trong cùng transaction; thiếu cành thì rollback, không tạo đơn.
- `ORD03` / quản trị hủy đơn hoàn lại số cành cho từng biến thể.
- `ORD01`, `ORD02` trả thêm `item_type` và `components` cho từng dòng hàng.

#### Lệnh cURL
```bash
curl -X POST "http://localhost:5000/api/v1/cart/bouquets" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"product_id":"<id hồng cành>","variant_id":"hong-canh-do","stems":3},{"product_id":"<id baby cành>","variant_id":"baby-canh-trang","stems":2}],"quantity":1}'
```

---

### 4.6. CART06 — Kiểu giấy gói và dáng bó
- **Method:** `GET`
- **Path:** `/api/v1/bouquets/options`
- **Quyền hạn:** Công khai (trang Tự tạo bó dùng được khi khách chưa đăng nhập).

Backend là nơi duy nhất giữ danh sách và bảng giá, frontend không tự khai lại.

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "wraps": [
      { "id": "kraft", "name": "Giấy kraft mộc", "price": 0, "colors": ["#d8c3a0", "#bb9f74"], "description": "Giấy nâu mộc, hợp mọi loại hoa" },
      { "id": "silk", "name": "Lụa Hàn Quốc", "price": 30000, "colors": ["#efe6f4", "#c6abd9"], "description": "Lụa mềm, ánh nhẹ, gói sang trọng" }
    ],
    "heights": [
      { "id": "low", "name": "Thấp, xòe rộng", "scale": 0.86, "spread": 1.3 },
      { "id": "medium", "name": "Vừa", "scale": 1, "spread": 1 },
      { "id": "tall", "name": "Cao, vươn thẳng", "scale": 1.16, "spread": 0.72 }
    ],
    "stem_length": { "min": 40, "max": 70, "step": 5, "default": 50 }
  }
}
```
`colors`, `scale` và `spread` chỉ dùng để vẽ ảnh xem trước ở frontend.

#### Kiểu gói trong giỏ và đơn hàng
Dòng bó trả thêm `style`:
```json
{
  "wrap": "silk",
  "wrap_name": "Lụa Hàn Quốc",
  "wrap_price": 30000,
  "height": "tall",
  "height_name": "Cao, vươn thẳng"
}
```
- `unit_price` của dòng bó = Σ(số cành × giá cành) **+** `wrap_price`.
- Mỗi phần tử của `components` trả thêm `stem_length` — chiều dài cành của riêng loại hoa đó.
- Hai bó khác nhau một chi tiết bất kỳ (thành phần, chiều dài cành của một loại hoa, giấy gói, dáng bó) là **hai dòng giỏ riêng**.
- `order_items.style` lưu lại kiểu gói lúc đặt để cửa hàng gói đúng và trang đơn hàng hiển thị.
- Giấy, dáng hoặc chiều dài không hợp lệ trả `400`: "Kiểu giấy gói không hợp lệ", "Dáng bó hoa không hợp lệ", "Chiều dài cành phải từ 40 đến 70 cm, cách nhau 5 cm".

#### Lệnh cURL
```bash
curl "http://localhost:5000/api/v1/bouquets/options"
```
