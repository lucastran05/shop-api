# Danh sách API cần thiết cho ABC Shop

Danh mục triển khai theo chức năng và giao diện cùng các trường response

Tài liệu bàn giao cho frontend và backend để thống nhất cách lấy dữ liệu và xử lý từng thao tác. Danh mục gồm 69 API phục vụ giao diện, một webhook thanh toán theo phương án tích hợp và ba API xóa nhiều còn cần xác định nghiệp vụ. Một API có thể được dùng ở nhiều màn hình.

Mã nguồn frontend hiện dùng dữ liệu mẫu và localStorage, chưa có lời gọi API nghiệp vụ. Vì vậy các đường dẫn và tên trường dưới đây là hợp đồng đề xuất để thay thế các thao tác cục bộ; chưa phải danh sách API backend đã triển khai. Phạm vi giao diện gồm 9 route khách hàng và 11 route quản trị.

## Cách đọc và sử dụng

Dùng bảng giao diện để tìm mã API, sau đó tra nhóm chức năng để lấy method, đường dẫn và response. Phần response chỉ liệt kê tên trường theo cấp dữ liệu, không đưa kiểu dữ liệu hay giá trị mẫu. Các câu hỏi cuối tài liệu là những điểm cần frontend và backend cùng chốt trước khi khóa hợp đồng.

| Đối tượng | Phạm vi |
| --- | --- |
| Guest | Xem sản phẩm, danh mục, đánh giá và thông tin shop; đăng ký, đăng nhập. |
| Người đăng nhập | Hồ sơ, địa chỉ, giỏ, đơn, thanh toán, đánh giá, chat và thông báo thuộc tài khoản của mình. |
| Manager | Các chức năng quản trị, trừ quản lý tài khoản. |
| Admin | Toàn bộ chức năng quản trị, bao gồm tài khoản. Tài khoản admin không bị xóa theo yêu cầu phỏng vấn. |

## Điểm cần xử lý trước khi nối API

Dùng chung nguồn sản phẩm, danh mục và tồn kho giữa khách hàng với quản trị; hiện hai phía đang có bộ dữ liệu tách biệt. Thống nhất chính sách cọc, phạm vi giao hàng và nguồn xác nhận thanh toán. Backend phải kiểm tra quyền và trạng thái thao tác, không dựa vào việc giao diện ẩn hoặc hiện nút.

Không phát sinh API cho thao tác thuần giao diện như mở popup, chọn tất cả, xóa bộ lọc, chuyển bước hoặc đổi ngôn ngữ cục bộ. Việc tìm kiếm gợi ý và bảng thanh toán tái sử dụng API danh sách sẵn có.

## Giao diện khách hàng và API tương ứng

| Route hoặc thành phần | Chức năng | Mã API |
| --- | --- | --- |
| / | Danh sách, bộ lọc, tìm kiếm, mở chi tiết | CAT01; CAT03 |
| /products/:id | Chi tiết, biến thể, mua ngay, đánh giá | CAT02; CART02; REV01–03; CHK01 |
| /cart | Danh sách giỏ, đổi số lượng, xóa, chọn món | CART01–04; CHK01 |
| /checkout | Địa chỉ, báo giá, tạo đơn, cọc, QR hoặc thẻ | ADR01; CHK01–02; PAY01–02 |
| /orders | Danh sách, chi tiết, hủy đơn | ORD01–03; dùng lại PAY02 khi theo dõi giao dịch |
| /account | Hồ sơ, địa chỉ, đổi mật khẩu | AUTH04–06; ADR01–07 |
| /login | Đăng nhập và đăng ký | AUTH01–02 |
| /shop-info | Tên, mô tả, liên hệ, hình thức shop | SHOP01 |
| /settings | Ngôn ngữ và múi giờ giao diện | Không cần API ở phạm vi hiện tại |
| Thành phần dùng chung | Phiên, đăng xuất, số giỏ, chat, thông báo | AUTH03–04; CART01; CHAT01–03; NOT01–03; SHOP01 |

Các route là đường dẫn trang trong ứng dụng. Chúng khác với đường dẫn API. Ví dụ /products/:id mở trang chi tiết; CAT02 gọi GET /api/v1/products/{product_id} để lấy dữ liệu.

## Giao diện quản trị và API tương ứng

| Route | Chức năng | Mã API |
| --- | --- | --- |
| /management/login | Đăng nhập và kiểm tra role | AUTH02, AUTH04 |
| /management | Số liệu tổng quan, trạng thái, đơn mới | DSH01 |
| /management/products | Sản phẩm, biến thể, ảnh, ghim, xóa nhiều | ADP01–07; ADC01 |
| /management/categories | Danh mục, đổi tên, xóa nhiều | ADC01–05 |
| /management/inventory | Tồn theo biến thể, điều chỉnh, lịch sử | INV01–03; xóa cần chốt |
| /management/orders | Tìm, lọc, xem, sửa trạng thái và vận đơn | ADO01–03; xóa nhiều cần chốt |
| /management/payments | Bảng tiền, xác nhận cọc, thu đủ, hoàn tiền | ADO01–02; ADY01–02; xóa cần chốt |
| /management/messages | Danh sách khách, lịch sử, phản hồi | ADM01–03 |
| /management/reports | Năm, khoảng ngày, biểu đồ, CSV | REP01 |
| /management/users | Danh sách, thêm, sửa, khóa và xóa | USR01–05; chỉ admin |
| /management/settings | Xem và lưu thông tin shop | SET01–02 |

Tiền tố /admin/ là quy ước đường dẫn theo phiếu, không đồng nghĩa mọi endpoint đều chỉ cho role admin. Tất cả nhóm quản trị cho manager và admin sử dụng, riêng USR01 đến USR05 chỉ cho admin.

## Quy ước hợp đồng và response

| Quy ước | Áp dụng |
| --- | --- |
| Đường dẫn | METHOD /api/v1/... cho API thông thường; METHOD /admin/... cho API quản trị. Dấu / tương ứng dấu \| trong ví dụ ban đầu. |
| Tên trường | Dùng snake_case. Chuyển variantId thành variant_id; createdAt và at thành created_at; featured thành is_pinned; active thành is_active. |
| Đối tượng và danh sách | data: trường của một đối tượng. data[]: trường của từng phần tử danh sách. data.items[]: danh sách nằm trong data. |
| Phân trang | pagination: page, limit, total, total_pages. Lịch sử chat dùng next_cursor và has_more. |
| Thông báo lỗi | error: code, message, details. error.details[]: field, message. Ví dụ nhóm lỗi: chưa đăng nhập, không đủ quyền, dữ liệu không hợp lệ, hết hàng, trạng thái đã đổi. |
| Xóa nhiều | data: deleted_ids, failed. data.failed[]: id, code, message. Frontend cập nhật các ID đã thành công và hiển thị các dòng bị từ chối. |
| Phiên đăng nhập | Đề xuất dùng cookie phiên do server quản lý; response AUTH02 chỉ cần user và expires_at. Nếu chọn bearer token, bổ sung token và refresh theo kiến trúc đã chốt; chưa tính endpoint refresh vào 69 API. |
| Tiền và thời gian | Thống nhất tiền VND dạng số nguyên và currency; deposit_rate theo phần trăm nguyên. Mốc created_at và các mốc nghiệp vụ dùng một chuẩn thời gian thống nhất; truy vấn báo cáo có timezone. |

### Các khái niệm cần giữ nhất quán

line_count là số dòng giỏ; item_count là tổng số lượng sản phẩm. stock_quantity của sản phẩm là tổng tồn các biến thể, còn trong variants là tồn từng biến thể. ID biến thể cần ổn định; trước khi bảo đảm ID duy nhất toàn hệ thống, luôn gửi cả product_id và variant_id.

Tách status của đơn, payment_status của thanh toán và deposit_status của cọc. paid_amount là tổng thu đã xác nhận; refunded_amount là tổng hoàn đã hoàn tất; held_amount là số đang giữ. remaining_amount phải do backend tính theo nghĩa vụ còn lại của đơn, đặc biệt khi đơn hủy hoặc hoàn. Không tự suy ra các khoản này chỉ từ nhãn trạng thái.

Các endpoint tạo đơn, thanh toán và điều chỉnh tồn phải tránh ghi hai lần khi người dùng bấm lại hoặc mạng gửi lại. Backend kiểm tra quyền sở hữu, tính lại số tiền, tồn kho và bước trạng thái hợp lệ ở thời điểm xử lý.

## Danh mục API theo chức năng

Tổng cộng 69 cặp method và đường dẫn duy nhất. Quyền và ghi chú của mỗi nhóm áp dụng cho toàn bộ API trong nhóm. Các trường request giúp xác định mục đích gọi; phần response là đầu ra cần giao cho frontend.

### 1 Đăng ký đăng nhập và hồ sơ

Giao diện: /login; /account; /management/login; nút đăng xuất

Quyền: Đăng ký và đăng nhập: công khai. Các API còn lại: người đã đăng nhập, chỉ tài khoản của mình.

#### AUTH01 — Tạo tài khoản khách hàng

`POST /api/v1/auth/register`

**Gửi:** Body: name, email, password, password_confirmation

**Response:**

```text
data: id, name, email, role, is_active, created_at
```

#### AUTH02 — Đăng nhập ở cả hai giao diện

`POST /api/v1/auth/login`

**Gửi:** Body: email, password

**Response:**

```text
data: user, expires_at
data.user: id, name, email, phone, role, is_active, default_address_id
```

#### AUTH03 — Đăng xuất và hủy phiên

`POST /api/v1/auth/logout`

**Gửi:** Không cần body

**Response:**

```text
data: success
```

#### AUTH04 — Khôi phục phiên và hiển thị hồ sơ

`GET /api/v1/me`

**Gửi:** Không có tham số

**Response:**

```text
data: id, name, email, phone, role, is_active, default_address_id, created_at, updated_at
```

#### AUTH05 — Lưu thông tin cá nhân

`PATCH /api/v1/me`

**Gửi:** Body: name, phone; email chỉ mở sau khi chốt quy tắc thay email

**Response:**

```text
data: id, name, email, phone, role, is_active, default_address_id, created_at, updated_at
```

#### AUTH06 — Đổi mật khẩu

`PUT /api/v1/me/password`

**Gửi:** Body: current_password, new_password, new_password_confirmation

**Response:**

```text
data: success, updated_at
```

Lưu ý triển khai: Dùng chung đăng nhập cho khách hàng và quản trị. Backend trả role; giao diện quản trị chỉ nhận manager hoặc admin đang hoạt động. Đăng ký luôn tạo customer. Email sửa được theo phiếu nhưng code đang khóa ô email; cần quyết định ở mục cần chốt.

Đối chiếu: K01; AuthPage.jsx; AccountPage.jsx; management/LoginPage.jsx; ShopContext.jsx

### 2 Địa chỉ nhận hàng và danh mục địa phương

Giao diện: /account tab địa chỉ; /checkout bước nhận hàng

Quyền: Địa chỉ: người đăng nhập, chỉ dữ liệu của mình. Danh mục địa phương: công khai.

#### ADR01 — Lấy địa chỉ và nhận diện địa chỉ mặc định

`GET /api/v1/me/addresses`

**Gửi:** Không có tham số

**Response:**

```text
data[]: id, recipient_name, recipient_phone, province_code, province_name, ward_code, ward_name, street_address, full_address, is_default
```

#### ADR02 — Thêm địa chỉ

`POST /api/v1/me/addresses`

**Gửi:** Body: recipient_name, recipient_phone, province_code, ward_code, street_address, is_default

**Response:**

```text
data: id, recipient_name, recipient_phone, province_code, province_name, ward_code, ward_name, street_address, full_address, is_default
```

#### ADR03 — Sửa địa chỉ

`PATCH /api/v1/me/addresses/{address_id}`

**Gửi:** Path: address_id. Body: các trường địa chỉ thay đổi

**Response:**

```text
data: id, recipient_name, recipient_phone, province_code, province_name, ward_code, ward_name, street_address, full_address, is_default
```

#### ADR04 — Xóa địa chỉ

`DELETE /api/v1/me/addresses/{address_id}`

**Gửi:** Path: address_id

**Response:**

```text
data: deleted_id, default_address_id
```

#### ADR05 — Đặt làm địa chỉ mặc định

`PATCH /api/v1/me/addresses/{address_id}/default`

**Gửi:** Path: address_id; không cần body

**Response:**

```text
data: id, is_default, default_address_id
```

#### ADR06 — Nạp lựa chọn tỉnh

`GET /api/v1/locations/provinces`

**Gửi:** Không có tham số

**Response:**

```text
data[]: code, name
```

#### ADR07 — Nạp lựa chọn xã theo tỉnh

`GET /api/v1/locations/wards`

**Gửi:** Query: province_code

**Response:**

```text
data[]: code, name, province_code
```

Lưu ý triển khai: Phiếu yêu cầu chọn tỉnh và xã. Code hiện chỉ có chuỗi địa chỉ tự nhập. Mã và danh sách địa phương phải lấy từ bộ dữ liệu thống nhất của dự án; không tự thêm cấp huyện khi chưa có yêu cầu.

Đối chiếu: K02, K05; AccountPage.jsx; CheckoutPage.jsx

### 3 Danh sách tìm kiếm và chi tiết sản phẩm

Giao diện: /; /products/:id; ô tìm kiếm trên thanh đầu trang

Quyền: Công khai; chỉ trả sản phẩm được phép hiển thị.

#### CAT01 — Nạp danh sách, lọc, tìm kiếm, phân trang và gợi ý

`GET /api/v1/products`

**Gửi:** Query: keyword, category_id, min_price, max_price, in_stock, is_pinned, sort, page, limit

**Response:**

```text
data[]: id, name, image_url, category, price, old_price, stock_quantity, is_pinned
data[].category: id, name
filters: min_price, max_price
pagination: page, limit, total, total_pages
```

#### CAT02 — Xem chi tiết và chọn biến thể

`GET /api/v1/products/{product_id}`

**Gửi:** Path: product_id

**Response:**

```text
data: id, name, description, category, images, variants, attributes, price, old_price, stock_quantity, is_pinned, allow_deposit, deposit_rate, created_at, updated_at
data.category: id, name
data.images[]: id, url, alt_text, sort_order
data.variants[]: id, label, color, price, old_price, stock_quantity
data.attributes[]: label, value
```

#### CAT03 — Nạp danh mục và số sản phẩm cho bộ lọc

`GET /api/v1/categories`

**Gửi:** Không có tham số

**Response:**

```text
data[]: id, name, product_count
```

Lưu ý triển khai: Gợi ý tìm kiếm dùng CAT01 với limit nhỏ; không cần API riêng. Ghim dùng is_pinned. Phiếu yêu cầu sản phẩm ghim đứng đầu kết quả, cần chốt mức ưu tiên khi khách chọn sắp xếp theo giá. Giỏ và đơn phải định danh đồng thời product_id và variant_id vì ID biến thể trong demo bị lặp giữa các sản phẩm.

Đối chiếu: K03; CatalogPage.jsx; ProductDetailPage.jsx; HeaderSearch.jsx; ProductCard.jsx; services/productService.js

### 4 Đánh giá sản phẩm và tải ảnh của khách

Giao diện: /products/:id phần đánh giá

Quyền: Đọc đánh giá: công khai. Gửi đánh giá và tải ảnh: người đăng nhập.

#### REV01 — Xem điểm trung bình và danh sách đánh giá

`GET /api/v1/products/{product_id}/reviews`

**Gửi:** Path: product_id. Query: page, limit

**Response:**

```text
data[]: id, product_id, author, rating, content, images, created_at
data[].author: id, name
data[].images[]: id, url
summary: average_rating, review_count
pagination: page, limit, total, total_pages
```

#### REV02 — Gửi đánh giá mới

`POST /api/v1/products/{product_id}/reviews`

**Gửi:** Path: product_id. Body: rating, content, image_ids

**Response:**

```text
data: id, product_id, author, rating, content, images, created_at
data.author: id, name
data.images[]: id, url
summary: average_rating, review_count
```

#### REV03 — Tải file ảnh trước khi lưu đánh giá

`POST /api/v1/uploads`

**Gửi:** Multipart: files, purpose

**Response:**

```text
data[]: id, url, file_name, mime_type, size_bytes
```

Lưu ý triển khai: Code có đánh giá 1 đến 5 sao, nội dung tối đa 1000 ký tự, tối đa 3 ảnh JPG PNG WebP, mỗi ảnh tối đa 2 MB. API phải kiểm tra lại các giới hạn. Chưa có UI sửa hoặc xóa đánh giá nên chưa đưa hai thao tác đó vào danh sách bắt buộc.

Đối chiếu: ProductReviews.jsx; ShopContext.jsx; có trong code, chưa được mô tả riêng trong phiếu

### 5 Giỏ hàng

Giao diện: /cart; nút thêm giỏ ở chi tiết sản phẩm; số lượng trên thanh đầu trang

Quyền: Người đăng nhập, chỉ giỏ của mình; áp dụng yêu cầu K04.

#### CART01 — Nạp giỏ và số lượng hiển thị ở header

`GET /api/v1/cart`

**Gửi:** Không có tham số

**Response:**

```text
data: id, items, line_count, item_count, subtotal, currency, updated_at
data.items[]: id, product_id, variant_id, product_name, variant_label, color, image_url, unit_price, quantity, stock_quantity, line_total, is_available
```

#### CART02 — Thêm biến thể vào giỏ hoặc tăng số lượng

`POST /api/v1/cart/items`

**Gửi:** Body: product_id, variant_id, quantity

**Response:**

```text
data: id, items, line_count, item_count, subtotal, currency, updated_at
data.items[]: id, product_id, variant_id, product_name, variant_label, color, image_url, unit_price, quantity, stock_quantity, line_total, is_available
```

#### CART03 — Đổi số lượng của dòng giỏ hàng

`PATCH /api/v1/cart/items/{item_id}`

**Gửi:** Path: item_id. Body: quantity

**Response:**

```text
data: id, items, line_count, item_count, subtotal, currency, updated_at
data.items[]: id, product_id, variant_id, product_name, variant_label, color, image_url, unit_price, quantity, stock_quantity, line_total, is_available
```

#### CART04 — Xóa một dòng giỏ

`DELETE /api/v1/cart/items/{item_id}`

**Gửi:** Path: item_id

**Response:**

```text
data: id, items, line_count, item_count, subtotal, currency, updated_at
data.items[]: id, product_id, variant_id, product_name, variant_label, color, image_url, unit_price, quantity, stock_quantity, line_total, is_available
```

Lưu ý triển khai: Chọn dòng và chọn tất cả có thể lưu tại frontend; khi báo giá chỉ gửi các dòng đã chọn. Không cần API riêng cho checkbox. Backend kiểm tra tồn và giá khi thêm, đổi số lượng và tạo đơn. subtotal ở giỏ là toàn bộ giỏ; subtotal cho các dòng được chọn do CHK01 trả về.

Đối chiếu: K04; CartPage.jsx; ShopContext.jsx; CustomerLayout.jsx

### 6 Báo giá và tạo đơn

Giao diện: /checkout các bước nhận hàng và kiểm tra; mua ngay từ /products/:id

Quyền: Người đăng nhập, chỉ giỏ và địa chỉ của mình.

#### CHK01 — Tính tiền và kiểm tra khả năng đặt hàng

`POST /api/v1/checkout/quote`

**Gửi:** Body: cart_item_ids HOẶC items[] {product_id, variant_id, quantity}; address_id HOẶC recipient {name, phone, province_code, ward_code, street_address}; delivery_method, coupon_code, payment_method, payment_mode, deposit_rate, note

**Response:**

```text
data: quote_id, expires_at, items, recipient, delivery_method, coupon, allowed_payment_methods, allowed_deposit_rates, subtotal, shipping_fee, discount_amount, total_amount, deposit_rate, deposit_amount, amount_due_now, paid_amount, refunded_amount, held_amount, remaining_amount, currency
data.items[]: product_id, variant_id, product_name, variant_label, color, image_url, unit_price, quantity, line_total, stock_quantity, is_available
data.recipient: name, phone, full_address
data.coupon: code, discount_amount
```

#### CHK02 — Xác nhận tạo một đơn từ báo giá

`POST /api/v1/orders`

**Gửi:** Header: Idempotency-Key. Body: quote_id; note nếu thay đổi. Thay đổi hàng, địa chỉ hoặc cách thanh toán phải lấy báo giá mới

**Response:**

```text
data: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount, held_amount, remaining_amount, created_at, updated_at, payment_method, payment_mode, delivery_method, amount_due_now, currency, removed_cart_item_ids
```

Lưu ý triển khai: CHK01 dùng chung cho áp mã giảm giá, đổi địa chỉ, phương thức nhận hàng và tỷ lệ cọc. Không cần API áp coupon riêng. Giá, phí, giảm giá và tồn phải do backend tính lại. Mua ngay gửi sản phẩm và biến thể, không sửa giỏ đang có. Chỉ loại các dòng giỏ đã đặt thành công sau khi tạo đơn; code hiện chưa làm bước này.

Đối chiếu: K05, K06; CheckoutPage.jsx; utils/checkout.js; ShopContext.jsx

### 7 Phiên thanh toán QR và thẻ

Giao diện: /checkout bước thanh toán; trạng thái thanh toán của đơn

Quyền: Người đăng nhập, chỉ thanh toán đơn của mình.

#### PAY01 — Tạo hoặc lấy phiên hợp lệ để trả đủ hoặc đặt cọc

`POST /api/v1/orders/{order_id}/payment-sessions`

**Gửi:** Path: order_id. Header: Idempotency-Key. Body: method, purpose. Backend xác định số tiền

**Response:**

```text
data: id, order_id, purpose, method, provider, status, amount, currency, qr_payload, qr_image_url, payment_url, expires_at, paid_at, failure_code, created_at
```

#### PAY02 — Theo dõi chờ trả tiền, thành công, lỗi hoặc hết hạn

`GET /api/v1/payments/{payment_id}`

**Gửi:** Path: payment_id

**Response:**

```text
data: id, order_id, purpose, method, provider, status, amount, currency, qr_payload, qr_image_url, payment_url, expires_at, paid_at, failure_code, created_at, order
data.order: id, payment_status, deposit_status, deposit_paid_at, paid_amount, remaining_amount
```

Lưu ý triển khai: PAY01 trả QR hoặc liên kết phiên thanh toán thẻ của nhà cung cấp. Frontend nhận kết quả qua PAY02, không tự gán đã thanh toán. Code chưa có QR thật, thời hạn phiên hay tích hợp thẻ. Phương án xác nhận tiền thủ công của quản trị được mô tả ở nhóm ADY; phải chốt cách phối hợp với cổng thanh toán.

Đối chiếu: K06, K07; CheckoutPage.jsx; thanh toán trong code hiện là mô phỏng

### 8 Danh sách chi tiết và hủy đơn của khách

Giao diện: /orders danh sách, popup chi tiết và xác nhận hủy

Quyền: Người đăng nhập, chỉ đơn của mình.

#### ORD01 — Xem đơn và lọc theo trạng thái

`GET /api/v1/orders`

**Gửi:** Query: status, page, limit

**Response:**

```text
data[]: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount, held_amount, remaining_amount, created_at, updated_at, item_count, items_preview, allowed_actions
data[].items_preview[]: product_name, variant_label, image_url, quantity
pagination: page, limit, total, total_pages
```

#### ORD02 — Mở chi tiết đơn và tiến trình

`GET /api/v1/orders/{order_id}`

**Gửi:** Path: order_id

**Response:**

```text
data: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, payment_method, payment_mode, delivery_method, subtotal, shipping_fee, discount_amount, total_amount, deposit_rate, deposit_amount, amount_due_now, paid_amount, refunded_amount, held_amount, remaining_amount, currency, recipient, items, shipment, history, allowed_actions, created_at, updated_at
data.recipient: name, phone, full_address, note
data.items[]: product_id, variant_id, product_name, variant_label, color, image_url, unit_price, quantity, line_total
data.shipment: carrier, tracking_number, shipped_at, delivered_at
data.history[]: id, status, label, note, created_at
```

#### ORD03 — Hủy đơn khi còn được phép

`POST /api/v1/orders/{order_id}/cancel`

**Gửi:** Path: order_id. Body: reason nếu cần

**Response:**

```text
data: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount, held_amount, remaining_amount, created_at, updated_at, allowed_actions
```

Lưu ý triển khai: Backend trả allowed_actions để bật nút hủy theo trạng thái thực tế; code hiện chỉ hủy khi chờ xác nhận. Timeline lấy từ history, không dựng toàn bộ tiến trình chỉ từ trạng thái cuối. Việc hủy đơn có tiền đã thu cần đi cùng quy tắc hoàn tiền.

Đối chiếu: K05; OrdersPage.jsx; ShopContext.jsx

### 9 Chat của khách và thông báo

Giao diện: Chat drawer và popover thông báo trong CustomerLayout

Quyền: Người đăng nhập, chỉ hội thoại và thông báo của mình.

#### CHAT01 — Mở chat, tạo hoặc trả lại hội thoại với shop

`POST /api/v1/conversations`

**Gửi:** Không cần truyền customer_id

**Response:**

```text
data: id, customer, last_message, created_at
data.customer: id, name, email
data.last_message: id, content, sender_role, created_at
```

#### CHAT02 — Nạp lịch sử hoặc nhận tin mới

`GET /api/v1/conversations/{conversation_id}/messages`

**Gửi:** Path: conversation_id. Query: cursor, limit, after_id

**Response:**

```text
data[]: id, conversation_id, content, sender_role, sender, created_at
data[].sender: id, name
pagination: next_cursor, has_more
```

#### CHAT03 — Gửi tin cho shop

`POST /api/v1/conversations/{conversation_id}/messages`

**Gửi:** Path: conversation_id. Body: content, client_message_id

**Response:**

```text
data: id, conversation_id, content, sender_role, sender, created_at, client_message_id
data.sender: id, name
```

#### NOT01 — Hiển thị thông báo và số chưa đọc

`GET /api/v1/notifications`

**Gửi:** Query: page, limit

**Response:**

```text
data[]: id, title, content, type, target_type, target_id, is_read, created_at
unread_count
pagination: page, limit, total, total_pages
```

#### NOT02 — Đánh dấu một thông báo đã đọc

`PATCH /api/v1/notifications/{notification_id}/read`

**Gửi:** Path: notification_id

**Response:**

```text
data: id, is_read, read_at
unread_count
```

#### NOT03 — Đánh dấu tất cả đã đọc

`POST /api/v1/notifications/read-all`

**Gửi:** Không cần body

**Response:**

```text
data: updated_count, read_at
unread_count
```

Lưu ý triển khai: Đề xuất ban đầu theo code: đăng nhập mới chat. Phiếu chưa chốt guest chat. Có thể lấy tin mới bằng after_id và gọi lại danh sách thông báo; chưa bắt buộc một API WebSocket riêng. Dùng sender_role để phân biệt khách và shop, created_at thống nhất cho cả hai phía.

Đối chiếu: K08, M06; CustomerLayout.jsx; ShopContext.jsx

### 10 Thông tin shop và tùy chọn giao diện

Giao diện: /shop-info; tên shop trên header; /settings

Quyền: Thông tin shop: công khai. Ngôn ngữ và múi giờ trong UI hiện lưu cục bộ.

#### SHOP01 — Hiển thị thông tin cửa hàng

`GET /api/v1/shop`

**Gửi:** Không có tham số

**Response:**

```text
data: id, name, description, business_mode, contact, updated_at
data.contact: address, phone, email, map_url, social_links
data.contact.social_links[]: label, url
```

Lưu ý triển khai: /settings chỉ đổi ngôn ngữ và múi giờ trong code hiện tại, chưa cần API. Chỉ bổ sung API tùy chọn người dùng nếu cần đồng bộ giữa các thiết bị. business_mode phục vụ trường hình thức trực tuyến trong phiếu; social_links có trong code nhưng chưa có ô sửa ở trang cấu hình quản trị.

Đối chiếu: K08; ShopInfoPage.jsx; SettingsPage.jsx; PreferencesProvider.jsx; useShopConfig.js

### 11 Quản trị sản phẩm và ảnh

Giao diện: /management/products danh sách, thêm, sửa, xem và chọn xóa

Quyền: Manager và admin.

#### ADP01 — Nạp bảng, tìm kiếm, phân trang

`GET /admin/products`

**Gửi:** Query: keyword, category_id, is_active, is_pinned, page, limit

**Response:**

```text
data[]: id, name, image_url, category, price_from, stock_quantity, is_pinned, is_active
data[].category: id, name
pagination: page, limit, total, total_pages
```

#### ADP02 — Nạp đầy đủ form sửa hoặc xem

`GET /admin/products/{product_id}`

**Gửi:** Path: product_id

**Response:**

```text
data: id, name, category_id, category, description, images, variants, is_active, is_pinned, allow_deposit, deposit_rate, created_at, updated_at
data.category: id, name
data.images[]: id, url, sort_order
data.variants[]: id, label, color, price, old_price, stock_quantity
```

#### ADP03 — Tạo sản phẩm cùng các biến thể

`POST /admin/products`

**Gửi:** Body: name, category_id, description, image_ids, is_active, is_pinned, allow_deposit, deposit_rate, variants[] {label, color, price, old_price, stock_quantity}

**Response:**

```text
data: id, name, category_id, category, description, images, variants, is_active, is_pinned, allow_deposit, deposit_rate, created_at, updated_at
data.category: id, name
data.images[]: id, url, sort_order
data.variants[]: id, label, color, price, old_price, stock_quantity
```

#### ADP04 — Lưu chỉnh sửa, ghim hoặc đổi trạng thái

`PATCH /admin/products/{product_id}`

**Gửi:** Path: product_id. Body: các trường thay đổi; variants giữ id cho biến thể cũ. Thay đổi tồn phải ghi lịch sử điều chỉnh

**Response:**

```text
data: id, name, category_id, category, description, images, variants, is_active, is_pinned, allow_deposit, deposit_rate, created_at, updated_at
data.category: id, name
data.images[]: id, url, sort_order
data.variants[]: id, label, color, price, old_price, stock_quantity
```

#### ADP05 — Xóa một sản phẩm khi hợp lệ

`DELETE /admin/products/{product_id}`

**Gửi:** Path: product_id

**Response:**

```text
data: deleted_id
```

#### ADP06 — Xóa các sản phẩm được chọn

`POST /admin/products/bulk-delete`

**Gửi:** Body: ids

**Response:**

```text
data: deleted_ids, failed
data.failed[]: id, code, message
```

#### ADP07 — Tải file ảnh sản phẩm

`POST /admin/uploads`

**Gửi:** Multipart: files, purpose

**Response:**

```text
data[]: id, url, file_name, mime_type, size_bytes
```

Lưu ý triển khai: Ghim, bật tắt và sửa biến thể dùng PATCH sản phẩm. Không cần thêm API riêng cho từng nút hoặc CRUD biến thể nếu form lưu cùng sản phẩm. Code hiện lưu một ảnh khi sửa và dùng chuỗi danh mục; API cần ảnh nhiều phần tử và category_id ổn định. Sau khi sản phẩm đã phát sinh đơn, việc xóa cần bảo toàn ảnh chụp dữ liệu của dòng đơn.

Đối chiếu: M01 và ghi chú cuối phiếu; management/ProductsPage.jsx; ProductImageInput.jsx; ManagementContext.jsx

### 12 Quản trị danh mục

Giao diện: /management/categories; lựa chọn danh mục ở form sản phẩm

Quyền: Manager và admin.

#### ADC01 — Nạp danh mục và số sản phẩm

`GET /admin/categories`

**Gửi:** Không có tham số

**Response:**

```text
data[]: id, name, product_count, created_at, updated_at
```

#### ADC02 — Thêm danh mục

`POST /admin/categories`

**Gửi:** Body: name

**Response:**

```text
data: id, name, product_count, created_at, updated_at
```

#### ADC03 — Đổi tên danh mục

`PATCH /admin/categories/{category_id}`

**Gửi:** Path: category_id. Body: name

**Response:**

```text
data: id, name, product_count, created_at, updated_at
```

#### ADC04 — Xóa một danh mục rỗng

`DELETE /admin/categories/{category_id}`

**Gửi:** Path: category_id

**Response:**

```text
data: deleted_id
```

#### ADC05 — Xóa các danh mục được chọn

`POST /admin/categories/bulk-delete`

**Gửi:** Body: ids

**Response:**

```text
data: deleted_ids, failed
data.failed[]: id, code, message
```

Lưu ý triển khai: Code không cho xóa danh mục còn sản phẩm. Giữ cùng quy tắc trên backend và trả lỗi ở failed khi xóa nhiều. Đổi tên danh mục không đổi ID. Không cần API tìm kiếm riêng cho màn hình này.

Đối chiếu: M01 và ghi chú cuối phiếu; management/CategoriesPage.jsx; ManagementContext.jsx

### 13 Kho theo biến thể và lịch sử điều chỉnh

Giao diện: /management/inventory; số hàng sắp hết trên dashboard

Quyền: Manager và admin.

#### INV01 — Nạp tồn kho, tìm và lọc sắp hết

`GET /admin/inventory`

**Gửi:** Query: keyword, low_stock, sort, page, limit

**Response:**

```text
data[]: product_id, product_name, variant_id, variant_label, color, stock_quantity, is_low_stock
low_stock_threshold
pagination: page, limit, total, total_pages
```

#### INV02 — Điều chỉnh tăng hoặc giảm tồn

`POST /admin/inventory/adjustments`

**Gửi:** Header: Idempotency-Key. Body: product_id, variant_id, delta, reason

**Response:**

```text
data: id, product_id, variant_id, delta, stock_before, stock_after, reason, actor, created_at
data.actor: id, name
```

#### INV03 — Xem lịch sử biến động

`GET /admin/inventory/adjustments`

**Gửi:** Query: product_id, variant_id, page, limit

**Response:**

```text
data[]: id, product_id, product_name, variant_id, variant_label, delta, stock_before, stock_after, reason, actor, created_at
data[].actor: id, name
pagination: page, limit, total, total_pages
```

Lưu ý triển khai: Sắp xếp theo tên sản phẩm rồi tên biến thể. Ngưỡng sắp hết trong code là 5; backend nên trả ngưỡng áp dụng. stock_quantity sau điều chỉnh không được âm. Checkbox xóa trong kho chưa có xử lý; ý nghĩa xóa được tách sang mục cần chốt.

Đối chiếu: M02 và ghi chú cuối phiếu; management/InventoryPage.jsx; ManagementContext.jsx

### 14 Quản trị đơn hàng

Giao diện: /management/orders; dữ liệu đơn ở /management/payments

Quyền: Manager và admin; truy cập toàn bộ đơn trong phạm vi quản trị.

#### ADO01 — Tìm đơn theo mã, tên hoặc email; lọc trạng thái

`GET /admin/orders`

**Gửi:** Query: keyword, status, payment_status, view, page, limit

**Response:**

```text
data[]: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount, held_amount, remaining_amount, created_at, updated_at, customer, recipient_name, payment_method, allowed_actions
data[].customer: id, name, email
pagination: page, limit, total, total_pages
```

#### ADO02 — Xem đơn và dữ liệu để sửa trạng thái

`GET /admin/orders/{order_id}`

**Gửi:** Path: order_id

**Response:**

```text
data: id, code, customer, status, status_label, payment_status, deposit_status, deposit_paid_at, payment_method, payment_mode, delivery_method, subtotal, shipping_fee, discount_amount, total_amount, deposit_rate, deposit_amount, amount_due_now, paid_amount, refunded_amount, held_amount, remaining_amount, currency, items, recipient, shipment, history, allowed_next_statuses, allowed_actions, created_at, completed_at, updated_at
data.customer: id, name, email, phone
data.items[]: product_id, variant_id, product_name, variant_label, color, image_url, unit_price, quantity, line_total
data.recipient: name, phone, full_address, note
data.shipment: carrier, tracking_number, shipped_at, delivered_at
data.history[]: id, status, label, note, actor_name, created_at
data.allowed_next_statuses[]: code, label
```

#### ADO03 — Cập nhật trạng thái và thông tin vận chuyển

`PATCH /admin/orders/{order_id}`

**Gửi:** Path: order_id. Body: status, carrier, tracking_number, note, expected_updated_at

**Response:**

```text
data: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount, held_amount, remaining_amount, created_at, updated_at, shipment, completed_at, allowed_next_statuses, allowed_actions
data.shipment: carrier, tracking_number, shipped_at, delivered_at
data.allowed_next_statuses[]: code, label
```

Lưu ý triển khai: ADO01 dùng lại cho bảng thanh toán với view=payments. Sửa trạng thái, đơn vị vận chuyển và mã vận đơn dùng cùng ADO03. Code yêu cầu carrier và tracking_number kể cả đơn nhận tại cửa hàng; backend cần bỏ điều kiện đó cho pickup. Hoàn tiền thực hiện qua ADY02, không chuyển trạng thái tùy ý để sửa số tiền.

Đối chiếu: M03, M05 và ghi chú cuối phiếu; management/OrdersPage.jsx; orderColumns.jsx; ManagementContext.jsx

### 15 Xác nhận thu tiền và hoàn tiền

Giao diện: /management/payments các nút xác nhận cọc, thanh toán đủ và hoàn tiền

Quyền: Manager và admin.

#### ADY01 — Ghi nhận đã thu cọc hoặc đã thu đủ

`POST /admin/orders/{order_id}/payment-confirmations`

**Gửi:** Path: order_id. Header: Idempotency-Key. Body: kind, amount, transaction_reference, note

**Response:**

```text
data: id, order_id, kind, amount, transaction_reference, status, confirmed_by, confirmed_at, order
data.order: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount, held_amount, remaining_amount, created_at, updated_at
```

#### ADY02 — Ghi nhận hoàn tiền hoặc gửi yêu cầu hoàn qua cổng

`POST /admin/orders/{order_id}/refunds`

**Gửi:** Path: order_id. Header: Idempotency-Key. Body: amount, reason, transaction_reference

**Response:**

```text
data: id, order_id, amount, status, reason, transaction_reference, requested_at, completed_at, order
data.order: id, code, status, status_label, payment_status, deposit_status, deposit_paid_at, total_amount, deposit_amount, paid_amount, refunded_amount, held_amount, remaining_amount, created_at, updated_at
```

Lưu ý triển khai: Bảng sử dụng ADO01, chi tiết dùng ADO02. Hai API này ghi nhận giao dịch và trả số dư mới; không lấy số dư do frontend tự cộng. Code hiện chỉ ghi nhận thủ công, chưa chuyển tiền thật. Nếu dùng cổng thanh toán, xác nhận và hoàn tiền phải đối soát giao dịch; không tính hai lần cùng một khoản thu.

Đối chiếu: M04 và ghi chú cuối phiếu; management/PaymentsPage.jsx; ManagementContext.jsx

### 16 Hội thoại phía quản trị

Giao diện: /management/messages danh sách, tìm khách và khung hội thoại

Quyền: Manager và admin.

#### ADM01 — Nạp hội thoại, tìm khách theo tên hoặc email

`GET /admin/conversations`

**Gửi:** Query: keyword, page, limit

**Response:**

```text
data[]: id, customer, last_message, updated_at
data[].customer: id, name, email
data[].last_message: id, content, sender_role, created_at
pagination: page, limit, total, total_pages
```

#### ADM02 — Nạp lịch sử hoặc nhận tin mới

`GET /admin/conversations/{conversation_id}/messages`

**Gửi:** Path: conversation_id. Query: cursor, limit, after_id

**Response:**

```text
data[]: id, conversation_id, content, sender_role, sender, created_at
data[].sender: id, name
customer: id, name, email
pagination: next_cursor, has_more
```

#### ADM03 — Shop gửi phản hồi

`POST /admin/conversations/{conversation_id}/messages`

**Gửi:** Path: conversation_id. Body: content, client_message_id

**Response:**

```text
data: id, conversation_id, content, sender_role, sender, created_at, client_message_id
data.sender: id, name
customer: id, name, email
```

Lưu ý triển khai: Mỗi hội thoại và tin mới trả tên cùng email khách để tránh phải tra lại bảng tài khoản. Chưa có thao tác đánh dấu đã đọc ở UI quản trị nên không bắt buộc API riêng cho việc này. Cần thống nhất giới hạn nội dung vì code khách giới hạn 1000 ký tự nhưng phía shop là 2000.

Đối chiếu: M06; management/MessagesPage.jsx; ManagementContext.jsx

### 17 Dashboard và báo cáo

Giao diện: /management; /management/reports

Quyền: Manager và admin.

#### DSH01 — Nạp thẻ tổng hợp, số đơn theo trạng thái và đơn gần đây

`GET /admin/dashboard`

**Gửi:** Query: from, to, timezone

**Response:**

```text
data: revenue, today_revenue, order_count, pending_order_count, low_stock_count, low_stock_threshold, status_counts, recent_orders, period
data.status_counts[]: status, label, count
data.recent_orders[]: id, code, customer_name, total_amount, status, created_at
data.period: from, to, timezone, revenue_date_basis
```

#### REP01 — Xem bảng, biểu đồ và xuất CSV theo kỳ

`GET /admin/reports/sales`

**Gửi:** Query: year HOẶC from, to; group_by, timezone, date_basis, format

**Response:**

```text
Khi format=json: data: summary, rows, period
data.summary: order_count, completed_order_count, revenue, held_amount, refunded_amount
data.rows[]: period_start, period_end, label, order_count, completed_order_count, revenue, held_amount, refunded_amount
data.period: from, to, timezone, date_basis, group_by
Khi format=csv: file CSV; cột period_start, period_end, label, order_count, completed_order_count, revenue, held_amount, refunded_amount
```

Lưu ý triển khai: Báo cáo cần lọc năm và khoảng ngày theo phiếu; code hiện chỉ có năm. CSV dùng cùng REP01 với format=csv hoặc frontend xuất từ toàn bộ dữ liệu của cùng bộ lọc. Không chỉ xuất trang đang nhìn. Dashboard và báo cáo cần thống nhất mốc thời gian tính doanh thu trước khi đối chiếu số liệu.

Đối chiếu: M07; management/DashboardPage.jsx; management/ReportsPage.jsx; utils/management.js

### 18 Quản trị tài khoản và phân quyền

Giao diện: /management/users danh sách và form thêm sửa

Quyền: Chỉ admin. Manager không được gọi các API USR.

#### USR01 — Nạp danh sách và tìm theo tên hoặc email

`GET /admin/users`

**Gửi:** Query: keyword, role, is_active, page, limit

**Response:**

```text
data[]: id, name, email, phone, role, is_active, created_at, updated_at
pagination: page, limit, total, total_pages
```

#### USR02 — Tạo tài khoản do admin quản lý

`POST /admin/users`

**Gửi:** Body: name, email, role, is_active; thông tin cấp quyền truy cập phải chốt trước triển khai

**Response:**

```text
data: id, name, email, phone, role, is_active, created_at, updated_at
```

#### USR03 — Sửa thông tin, đổi role, khóa hoặc mở khóa

`PATCH /admin/users/{user_id}`

**Gửi:** Path: user_id. Body: name, email, phone, role, is_active

**Response:**

```text
data: id, name, email, phone, role, is_active, created_at, updated_at
```

#### USR04 — Xóa một tài khoản không phải admin

`DELETE /admin/users/{user_id}`

**Gửi:** Path: user_id

**Response:**

```text
data: deleted_id
```

#### USR05 — Xóa nhiều tài khoản hợp lệ

`POST /admin/users/bulk-delete`

**Gửi:** Body: ids

**Response:**

```text
data: deleted_ids, failed
data.failed[]: id, code, message
```

Lưu ý triển khai: Theo phiếu, mọi tài khoản admin đều chỉ được sửa, không được xóa; code hiện mới chặn xóa chính mình. Role có thể là customer, manager, admin. Không cần API danh sách role khi ba giá trị cố định. Cách cấp mật khẩu cho tài khoản do admin tạo chưa được UI và phiếu xác định.

Đối chiếu: A01 và ghi chú cuối phiếu; management/UsersPage.jsx; ManagementContext.jsx; ManagementRoutes.jsx

### 19 Cấu hình thông tin shop

Giao diện: /management/settings

Quyền: Manager và admin theo quyền trong phiếu và code.

#### SET01 — Nạp form cấu hình shop

`GET /admin/settings/shop`

**Gửi:** Không có tham số

**Response:**

```text
data: id, name, description, business_mode, contact, updated_at
data.contact: address, phone, email, map_url, social_links
data.contact.social_links[]: label, url
```

#### SET02 — Lưu thông tin công khai của shop

`PATCH /admin/settings/shop`

**Gửi:** Body: name, description, contact {address, phone, email, map_url}; business_mode nếu bổ sung ô theo phiếu. social_links chỉ sửa khi có UI tương ứng

**Response:**

```text
data: id, name, description, business_mode, contact, updated_at
data.contact: address, phone, email, map_url, social_links
data.contact.social_links[]: label, url
```

Lưu ý triển khai: Lưu xong phải làm mới SHOP01 và tên shop ở layout. Các trường giá vận chuyển, mã giảm giá, tỷ lệ cọc hiện nằm ở nhiều hằng số; chưa có form quản trị chung cho chúng nên không tự thêm một module cấu hình thương mại ngoài phạm vi.

Đối chiếu: A01 và ghi chú cấu hình cuối phiếu; management/SettingsPage.jsx; ShopContext.jsx

## API tích hợp và yêu cầu còn điều kiện

### Webhook thanh toán khi dùng cổng thanh toán

SYS01  POST /api/v1/payments/webhooks/{provider}

Đây là endpoint nhận thông báo từ nhà cung cấp, không phải lời gọi của frontend và không tính vào 69 API giao diện. Chỉ cần khi triển khai cổng thanh toán có webhook. Backend xác thực chữ ký, nhận diện giao dịch và xử lý sự kiện trùng trước khi cập nhật đơn.

Body và response xác nhận theo đúng hợp đồng của nhà cung cấp được chọn; chưa đặt tên trường giả định. Kết quả chuẩn hóa mà frontend đọc lại qua PAY02 gồm id, order_id, status, amount, currency, paid_at, failure_code và data.order với các khoản tiền cùng trạng thái mới.

### Ba thao tác xóa cần xác định đối tượng và điều kiện

| Mã | Endpoint dự kiến | Điều kiện và trường cần trả |
| --- | --- | --- |
| X01 | POST /admin/orders/bulk-delete | Chỉ sau khi chốt điều kiện xóa hoặc lưu trữ đơn. Body: ids. Response: data.deleted_ids; data.failed[]: id, code, message. Nếu là lưu trữ, đổi endpoint và response sang archive/archived_ids. |
| X02 | POST /admin/inventory/bulk-delete | Chỉ sau khi xác định xóa đối tượng nào. Body: items[] {product_id, variant_id}. Response: data.deleted_items[] {product_id, variant_id}; data.failed[] {product_id, variant_id, code, message}. Không dùng xóa lịch sử thay cho điều chỉnh tồn. |
| X03 | POST /admin/payments/bulk-delete | UI hiện lấy từng dòng từ đơn, chưa có đối tượng payment riêng để xóa. Nếu xác nhận là xóa bản ghi giao dịch hợp lệ: Body ids; Response data.deleted_ids; data.failed[] {id, code, message}. Nếu chỉ ẩn dòng đơn, dùng nghiệp vụ lưu trữ đơn thay vì tạo API này. |

Ba endpoint trên chưa nằm trong danh mục chốt triển khai. Chỉ chọn đường dẫn cuối cùng khi đã rõ đối tượng bị tác động và cách giữ lịch sử. Không biến thao tác xóa dòng hiển thị thành xóa số dư hoặc lịch sử giao dịch.

### Những phần chưa cần API riêng

Ngôn ngữ và múi giờ cục bộ; danh sách role cố định; ghim sản phẩm qua PATCH sản phẩm; áp coupon qua báo giá; gợi ý tìm kiếm qua danh sách sản phẩm; bảng thanh toán qua danh sách đơn; xuất CSV qua báo cáo; chọn nhiều, chọn tất cả và mở popup xử lý ở frontend. Chưa có màn hình POS, module vận chuyển riêng hay form quản trị coupon trong phạm vi hiện tại.

## Các câu hỏi cần chốt với frontend và backend

### 1 Quyền thêm giỏ và chat

Hiện trạng: K04 yêu cầu đăng nhập mới thêm giỏ; code cho guest thêm. Chat trong code cần đăng nhập, phiếu chưa trả lời rõ guest.

Cần chốt: Áp dụng giỏ chỉ cho người đăng nhập. Chat có cho khách vãng lai không, và nếu có thì nhận diện, lấy lịch sử bằng cách nào?

### 2 Một chính sách đặt cọc

Hiện trạng: Trang chi tiết dùng tỷ lệ 20 phần trăm; checkout cho 50 hoặc 70 phần trăm với mọi sản phẩm; quản trị có cờ cọc và tỷ lệ theo sản phẩm.

Cần chốt: Cọc áp dụng cho mọi sản phẩm hay sản phẩm được bật? Tỷ lệ lấy theo sản phẩm hay theo toàn đơn? Với giỏ hỗn hợp tính thế nào? CHK01 phải trả các lựa chọn hợp lệ.

### 3 Giao tận nơi hay chỉ nhận tại shop

Hiện trạng: K05 có giao tận nơi, M05 ghi không có giao hàng, ghi chú cuối phiếu và code lại có hãng vận chuyển và mã vận đơn.

Cần chốt: Đề xuất không có màn hình giao hàng riêng, vẫn cập nhật vận chuyển trong đơn. Xác nhận có giữ ship không. Nếu chỉ pickup, bỏ phí và trường vận đơn tương ứng.

### 4 Thu tiền thủ công và cổng thanh toán

Hiện trạng: Phiếu yêu cầu QR, thẻ và mã hết hạn, đồng thời quản lý xác nhận cọc, thu đủ và hoàn tiền. Code mới thay đổi dữ liệu local.

Cần chốt: Chọn nhà cung cấp; xác nhận QR tĩnh hay phiên thanh toán; nguồn nào chốt thành công? Hoàn tiền là ghi nhận đã hoàn ngoài hệ thống hay gọi cổng? Thời hạn, trả phần còn lại và xử lý giao dịch trùng thế nào?

### 5 Xóa nhiều đơn kho và thanh toán

Hiện trạng: Phiếu yêu cầu xóa; các bảng tương ứng trong code có chọn dòng nhưng chưa có handler xóa.

Cần chốt: Xóa có nghĩa là ẩn, lưu trữ, vô hiệu hóa biến thể hay xóa dữ liệu? Đơn có tiền hoặc lịch sử xử lý phải giữ dấu vết. Chốt trước khi triển khai ba API điều kiện đã liệt kê.

### 6 Hồ sơ và cấp tài khoản

Hiện trạng: Phiếu cho sửa email; code khóa email. Form thêm tài khoản quản trị chưa có mật khẩu. Code mới bảo vệ tài khoản admin đang dùng khỏi xóa.

Cần chốt: Có cho đổi email, cần xác minh không? Admin tạo mật khẩu ban đầu hay gửi lời mời? Bảo vệ mọi tài khoản admin khỏi xóa theo phiếu; chặn tự khóa hoặc tự hạ quyền gây mất truy cập.

### 7 Doanh thu và tiền đang giữ

Hiện trạng: Dashboard dựa thời điểm hoàn thành; báo cáo nhóm theo ngày tạo đơn. Code đặt paid về 0 sau hoàn, làm mất ý nghĩa tổng tiền đã thu.

Cần chốt: Chốt ngày ghi nhận từng chỉ số, múi giờ và đơn vị tính. Tách tổng thu, tổng hoàn và tiền đang giữ. Doanh thu có bao gồm phí giao hàng và đã trừ hoàn hay chưa?

### 8 Tìm kiếm ghim và khoảng giá

Hiện trạng: Phiếu tìm theo tên và ghim lên đầu; code có tìm cả mô tả, một ngưỡng giá tối đa và cách sắp xếp giá có thể vượt ưu tiên ghim.

Cần chốt: Tìm tên hay cả mô tả? Ghép nhiều từ, bỏ dấu thế nào? Ghim luôn ưu tiên hay chỉ mặc định? Khoảng giá áp dụng giá thấp nhất hay biến thể phù hợp?

### 9 Tồn kho và vòng đời đơn

Hiện trạng: Demo chỉ lưu tồn và đơn cục bộ; chưa có giữ tồn đồng thời giữa nhiều người dùng.

Cần chốt: Giữ tồn khi tạo đơn hay khi trả tiền? Khi nào hết hạn và trả lại tồn? Hủy, hoàn hàng có tự tăng tồn không? Mỗi lần biến động cần ghi lý do và người thực hiện.

### 10 Các dữ liệu chưa thống nhất

Hiện trạng: Danh mục và sản phẩm quản trị tách khỏi catalog tĩnh; ảnh form quản trị còn một ảnh; địa chỉ tự nhập; tin nhắn dùng at và createdAt ở hai phía.

Cần chốt: Dùng chung nguồn sản phẩm, danh mục và tồn. Bổ sung nhiều ảnh và tỉnh xã; thống nhất created_at, hướng người gửi và giới hạn tin nhắn trước khi nối API.

## Cách bàn giao và xác nhận

Frontend mở từng giao diện theo hai bảng đầu tài liệu và xác nhận từng mã API đủ dữ liệu để hiển thị, đủ thao tác để hoàn tất luồng. Backend xác nhận đường dẫn, quyền, quy tắc số tiền và trạng thái. Sau khi chốt, dùng bảng dưới để ghi thay đổi hợp đồng; chỉ đổi endpoint một lần ở nhóm chức năng rồi cập nhật tất cả màn hình dùng lại.

| Mã API hoặc vấn đề | Kết luận thống nhất | Người phụ trách và ngày | Trạng thái |
| --- | --- | --- | --- |
| [Điền mã] | [Đường dẫn, trường response hoặc quy tắc được chốt] | [FE / BE / nghiệp vụ; ngày] | [Đề xuất / đã chốt] |
| [Điền mã] | [Điểm còn thiếu và việc cần bổ sung] | [Người xử lý; hạn] | [Chờ trả lời] |

### Các luồng cần kiểm tra khi tích hợp

Đăng ký, đăng nhập, tải lại trang và đăng xuất; manager bị chặn quản lý tài khoản ngay tại backend.

Thay đổi sản phẩm, danh mục, ảnh, ghim và tồn ở quản trị phải phản ánh đúng ở catalog và chi tiết của khách.

Chọn một phần giỏ, mua ngay, áp coupon, đổi địa chỉ và cọc phải dùng số tiền báo giá mới; tạo đơn lại không sinh đơn trùng.

QR hoặc thẻ thành công, thất bại, hết hạn, xác nhận thủ công trùng và hoàn tiền phải cho số dư nhất quán ở cả hai giao diện.

Chuyển trạng thái hợp lệ, hủy đơn và xử lý nhận tại cửa hàng; tồn không âm khi nhiều người mua đồng thời.

Chat hiển thị đúng người gửi và thời gian ở hai phía; thông báo có số chưa đọc đúng sau đánh dấu.

Báo cáo, dashboard và CSV khớp cùng bộ lọc, múi giờ và cách tính tiền đã được chốt.

### Nguồn đối chiếu

Gốc đường dẫn mã nguồn là shop-web-main trong gói zip được cung cấp. Các tên tệp rút gọn ở từng nhóm được đối chiếu với các thư mục dưới đây. Những trường bổ sung nhằm nối dữ liệu và kiểm soát xử lý được ghi như đề xuất hợp đồng, không khẳng định đã tồn tại trong backend.

| Nhóm | Tệp hoặc mục nguồn |
| --- | --- |
| Phạm vi và route | src/routes/CustomerRoutes.jsx; src/routes/ManagementRoutes.jsx; src/layouts/CustomerLayout.jsx |
| Trạng thái và nguồn dữ liệu | src/context/ShopContext.jsx; src/context/ManagementContext.jsx; src/hooks/useSaved.js; src/services/productService.js |
| Khách hàng | src/pages/AuthPage.jsx; AccountPage.jsx; CatalogPage.jsx; ProductDetailPage.jsx; CartPage.jsx; CheckoutPage.jsx; OrdersPage.jsx; ShopInfoPage.jsx; SettingsPage.jsx |
| Thành phần và quy tắc | src/components/HeaderSearch.jsx; ProductCard.jsx; ProductReviews.jsx; management/ProductImageInput.jsx; src/utils/checkout.js; search.js; management.js |
| Quản trị | src/pages/management/LoginPage.jsx; DashboardPage.jsx; ProductsPage.jsx; CategoriesPage.jsx; InventoryPage.jsx; OrdersPage.jsx; PaymentsPage.jsx; MessagesPage.jsx; ReportsPage.jsx; UsersPage.jsx; SettingsPage.jsx |
| Phiếu phỏng vấn | Form_phong_van_frontend_API_va_response (1)(1).docx; các mục K01 đến K08, M01 đến M07, A01 và ghi chú bổ sung cuối phần trả lời |
