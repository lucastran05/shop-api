# NHẬN DIỆN HOA (FLOWER) API SPECIFICATION
> **Mô tả tài liệu:** Đặc tả chức năng nhận diện hoa bằng ảnh, lọc sản phẩm theo loài hoa và lịch sử nhận diện (kèm ảnh) của khách hàng.
> **Cập nhật lần cuối:** 2026-11-06
> **Trạng thái:** In Review

## 1. Giới thiệu phân hệ & Nghiệp vụ

- **Mục tiêu:** Khách chụp hoặc tải ảnh một bông hoa, hệ thống cho biết đó là loài gì (tên tiếng Việt, tên khoa học, họ, độ phù hợp), giải thích ý nghĩa hoặc giới thiệu loài hoa, và lưu ảnh cùng kết quả vào lịch sử tài khoản.
- **Quy tắc nghiệp vụ chính:**
  - Phải đăng nhập mới được nhận diện và xem lịch sử.
  - Ảnh được gửi sang Pl@ntNet để nhận diện. Khi nhận diện có kết quả, shop lưu **cả ảnh lẫn kết quả** vào lịch sử của tài khoản. Ảnh là **riêng tư**: không có URL công khai, chỉ chủ tài khoản tải được qua API có token.
  - Nhận diện không có kết quả thì không lưu gì, kể cả ảnh.
  - Xóa bản ghi lịch sử (hoặc xóa toàn bộ) sẽ xóa luôn file ảnh trong storage.
  - Giao diện chỉ hiển thị **một loài có điểm cao nhất**. API vẫn trả tối đa 3 ứng viên và lưu cả 3 vào lịch sử.
  - Mỗi lần nhận diện thành công (có ít nhất 1 kết quả) tự động tạo 1 bản ghi lịch sử. Không có kết quả thì không lưu.
  - Lịch sử chỉ chủ tài khoản đọc và xóa được. Xóa tài khoản sẽ xóa toàn bộ lịch sử (`ON DELETE CASCADE`).
  - Popup nhận diện **không hiển thị gợi ý sản phẩm**. API lọc sản phẩm theo loài (mục 5.6) vẫn còn, chỉ khớp khi admin đã gắn đúng tên khoa học vào sản phẩm.

## 2. Luồng xử lý

```
Ảnh (JPEG/PNG ≤ 10 MB)
  → POST /api/v1/flowers/identify
      1. Kiểm tra định dạng bằng magic bytes, kích thước
      2. Gửi Pl@ntNet (organs=flower), timeout 20 giây, lấy 3 kết quả điểm cao nhất
      3. Loài đứng đầu: tra Wikipedia lấy tên Việt và đoạn giới thiệu
      4. Lưu ảnh vào storage riêng tư, lưu kết quả + image_key vào flower_identifications
  ← candidates + historyId
```

### 2.1. Nguồn tên tiếng Việt và nội dung

Pl@ntNet chỉ trả tên thông dụng tiếng Anh, nên tên tiếng Việt và nội dung được ghép từ nhiều nguồn theo thứ tự ưu tiên:

| Thứ tự | Tên hiển thị (giao diện tiếng Việt) | Nơi xử lý |
| :---: | :--- | :--- |
| 1 | Bảng tên theo **loài** soạn sẵn, ví dụ `Nelumbo nucifera` là Hoa sen | `shop-web/src/shared/utils/flowerNames.js` (`SPECIES`) |
| 2 | Tiêu đề bài Wikipedia tiếng Việt, khi bài được redirect sang tên Việt | `shop-api/src/services/flower-description.js` |
| 3 | Tên ở đầu câu đầu tiên của bài, ví dụ "Tuyết mai là loài..." | như trên |
| 4 | Tên ở bài Wikipedia của **chi**, ví dụ `Spiraea` là Mơ Trân châu | như trên |
| 5 | Bảng tên theo **chi** soạn sẵn, ví dụ mọi `Rosa` là Hoa hồng | `flowerNames.js` (`GENUS`) |
| 6 | Tên khoa học. Giao diện tiếng Việt không bao giờ hiện tên tiếng Anh | `flowerNames.js` |

Nội dung bên dưới tên:

- **Ý nghĩa:** nếu chi/loài có trong bảng `MEANINGS` soạn sẵn (khoảng 30 chi hoa phổ biến: hồng, cúc, ly, sen, lan, đào, mai, cẩm chướng...), hiện ý nghĩa biểu tượng theo ngôn ngữ loài hoa và phong tục Việt.
- **Giới thiệu:** nếu không có ý nghĩa soạn sẵn, hiện đoạn tóm tắt Wikipedia (tối đa khoảng 420 ký tự), đã lược câu "Loài này được ... miêu tả khoa học đầu tiên năm ...", kèm link "Đọc thêm trên Wikipedia".
- Không có cả hai thì chỉ hiện tên, điểm và họ.

### 2.2. Gọi Wikipedia

- REST API `https://{vi|en}.wikipedia.org/api/rest_v1/page/summary/{tên}`. Tiếng Anh chỉ gọi khi request có `?lang=en`.
- Chỉ nhận trang `type = standard`, bỏ trang định hướng.
- Cache trong RAM theo tên khoa học và ngôn ngữ, tối đa 500 loài. Không cache kết quả gặp lỗi mạng, timeout, 5xx hoặc 429.
- Gặp HTTP 429 thì tạm ngừng gọi Wikipedia theo `Retry-After` (mặc định 5 phút). Trong thời gian đó nhận diện vẫn chạy, chỉ thiếu tên Việt/giới thiệu từ Wikipedia.
- Không bao giờ làm hỏng request nhận diện: lỗi Wikipedia chỉ để trống các trường liên quan.
- Wikimedia yêu cầu User-Agent có thông tin liên hệ và có thể chặn cả IP nếu thiếu. Đặt `WIKIPEDIA_USER_AGENT` khi triển khai thật.

## 3. Thông tin chung

- **Base URL:** `/api/v1/flowers`
- **Phân quyền:** `Customer` (mọi tài khoản đã đăng nhập). Riêng `/api/v1/admin/flower-species` cần admin/manager.
- **Headers:** `Authorization: Bearer <access_token>`
- **Cấu hình:**

| Biến môi trường | Bắt buộc | Ý nghĩa |
| :--- | :---: | :--- |
| `PLANTNET_API_KEY` | Có | Key của my.plantnet.org. Thiếu thì `/identify` trả 503 |
| `WIKIPEDIA_USER_AGENT` | Không | User-Agent khi gọi Wikipedia, nên có email/URL liên hệ. Mặc định: `ABCShopFlowerIdentifier/1.0 (...)` |

Khi chạy bằng Compose, đặt các biến này trong `.env` ở thư mục gốc rồi recreate service `api`. Bảng `flower_identifications` và cột `products.flower_species` được `initDB` tự tạo lúc khởi động, chạy lại an toàn.

## 4. Danh sách Endpoints

| STT | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :--- | :--- |
| 1 | `POST` | `/api/v1/flowers/identify` | Customer | Nhận diện hoa từ ảnh, tự lưu lịch sử |
| 2 | `GET` | `/api/v1/flowers/history` | Customer | Danh sách lịch sử nhận diện, có phân trang |
| 3 | `GET` | `/api/v1/flowers/history/:id` | Customer | Chi tiết một lần nhận diện |
| 4 | `DELETE` | `/api/v1/flowers/history/:id` | Customer | Xóa một bản ghi lịch sử |
| 5 | `GET` | `/api/v1/flowers/history/:id/image` | Customer | Tải ảnh gốc của một lần nhận diện |
| 6 | `DELETE` | `/api/v1/flowers/history` | Customer | Xóa toàn bộ lịch sử và ảnh của tài khoản |
| 7 | `GET` | `/api/v1/products?flower_species=...` | Public | Sản phẩm gắn với một loài hoa |
| 8 | `GET` | `/api/v1/admin/flower-species` | Admin/Manager | Danh sách loài đã gắn vào sản phẩm |

## 5. Chi tiết từng Endpoint

### 5.1. Nhận diện hoa

- **Method / Path:** `POST /api/v1/flowers/identify?lang=vi`
- **Body:** `multipart/form-data`, đúng một file `image` JPEG hoặc PNG, 1 byte đến 10 MB. Không nhận field khác.
- **Query:** `lang` = `vi` (mặc định) hoặc `en`. `en` thì backend lấy thêm đoạn giới thiệu tiếng Anh.
- **Giới hạn:** 10 request / 15 phút / tài khoản, tính cả request lỗi validation.

#### Response 200

```json
{
  "status": "success",
  "data": {
    "historyId": "8b0f3c1e-5d2a-4f8e-9a51-2c7d1e6b9f40",
    "candidates": [
      {
        "scientificName": "Spiraea thunbergii",
        "commonNames": ["Thunberg's Meadowsweet"],
        "family": "Rosaceae",
        "score": 0.387,
        "vietnameseName": "Tuyết mai",
        "description": {
          "vi": "Tuyết mai là loài thực vật có hoa trong họ Hoa hồng.",
          "en": ""
        }
      },
      { "scientificName": "Spiraea cantoniensis", "commonNames": [], "family": "Rosaceae", "score": 0.12 }
    ]
  }
}
```

- `candidates` đã sắp theo `score` giảm dần, tối đa 3 phần tử. Chỉ phần tử đầu có `vietnameseName` và `description`.
- `score` là điểm của mô hình Pl@ntNet (0 đến 1), không phải xác suất đúng tuyệt đối. Giao diện chia mức: Cao từ 0.6, Trung bình từ 0.3, còn lại là Thấp.
- `candidates: []` nghĩa là Pl@ntNet xác nhận không tìm thấy loài. Khi đó `historyId` là `null`.
- `historyId` là `null` nếu lưu lịch sử thất bại. Kết quả nhận diện vẫn được trả về bình thường.

#### Lỗi

| HTTP | Khi nào |
| :---: | :--- |
| 400 | Thiếu ảnh |
| 401 | Chưa đăng nhập hoặc token hết hạn |
| 413 | Ảnh lớn hơn 10 MB |
| 415 | Không phải JPEG/PNG hợp lệ (kiểm tra cả MIME lẫn magic bytes) |
| 429 | Vượt 10 lượt / 15 phút |
| 502 | Pl@ntNet lỗi hoặc trả dữ liệu không hợp lệ |
| 503 | Chưa cấu hình `PLANTNET_API_KEY` hoặc hết quota Pl@ntNet |
| 504 | Pl@ntNet quá 20 giây |

Body lỗi: `{ "status": "error", "message": "..." }`. Thông báo đã được làm sạch, không lộ URL chứa API key.

### 5.2. Danh sách lịch sử nhận diện

- **Method / Path:** `GET /api/v1/flowers/history?page=1&limit=20`
- **Query:** `page` số nguyên từ 1 (mặc định 1), `limit` từ 1 đến 50 (mặc định 20). Sai thì 400.
- Sắp xếp mới nhất trước.

```json
{
  "status": "success",
  "data": [
    {
      "id": "8b0f3c1e-5d2a-4f8e-9a51-2c7d1e6b9f40",
      "scientificName": "Spiraea thunbergii",
      "vietnameseName": "Tuyết mai",
      "commonNames": ["Thunberg's Meadowsweet"],
      "family": "Rosaceae",
      "score": 0.387,
      "description": { "vi": "Tuyết mai là loài thực vật có hoa trong họ Hoa hồng.", "en": "" },
      "candidates": [
        { "scientificName": "Spiraea thunbergii", "commonNames": ["Thunberg's Meadowsweet"], "family": "Rosaceae", "score": 0.387 }
      ],
      "hasImage": true,
      "createdAt": "2026-11-06T05:12:44.120Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 }
}
```

### 5.3. Chi tiết một lần nhận diện

- **Method / Path:** `GET /api/v1/flowers/history/:id`
- Response: `{ "status": "success", "data": <bản ghi như mục 5.2> }`.
- 400 nếu `id` không phải UUID. 404 nếu không tồn tại **hoặc thuộc tài khoản khác** (không phân biệt hai trường hợp để tránh dò id).

### 5.3a. Ảnh của một lần nhận diện

- **Method / Path:** `GET /api/v1/flowers/history/:id/image`
- Trả về nội dung ảnh gốc (`image/jpeg` hoặc `image/png`), header `Cache-Control: private, max-age=86400`.
- 400 nếu `id` không phải UUID. 404 nếu bản ghi không tồn tại, thuộc tài khoản khác, hoặc không có ảnh (`hasImage: false`, ví dụ lưu ảnh lỗi lúc nhận diện).
- Frontend tải bằng http client với `responseType: "blob"` rồi hiển thị qua `URL.createObjectURL`, vì thẻ `<img>` không tự gửi Bearer token.

### 5.4. Xóa một bản ghi

- **Method / Path:** `DELETE /api/v1/flowers/history/:id`
- Xóa luôn file ảnh của bản ghi trong storage.
- Response: `{ "status": "success", "message": "Đã xóa lịch sử nhận diện" }`.
- 400 / 404 như mục 5.3.

### 5.5. Xóa toàn bộ lịch sử

- **Method / Path:** `DELETE /api/v1/flowers/history`
- Chỉ xóa lịch sử và ảnh của tài khoản đang đăng nhập.
- Response: `{ "status": "success", "message": "Đã xóa toàn bộ lịch sử nhận diện", "data": { "deleted": 3 } }`.

### 5.6. Sản phẩm theo loài hoa

- **Method / Path:** `GET /api/v1/products?flower_species=Spiraea%20thunbergii&limit=6`
- So khớp **toàn bộ** tên khoa học trong mảng `products.flower_species`, sau khi bỏ khoảng trắng thừa và không phân biệt hoa/thường. `Rosa` không khớp `Rosa chinensis`. Không ghép tên đồng nghĩa hay tên thông dụng.
- Chỉ trả sản phẩm active và visibility `public`. Sản phẩm hết hàng vẫn được trả. Giữ cấu trúc phân trang, giá, tồn kho của catalog.

### 5.7. Danh sách loài đã gắn (admin)

- **Method / Path:** `GET /api/v1/admin/flower-species`, quyền admin/manager.
- Response: `{ "status": "success", "data": ["Rosa chinensis"] }`, dùng làm gợi ý cho ô Loài hoa khi sửa sản phẩm.

### 5.8. Gắn loài hoa cho sản phẩm

Body tạo/sửa sản phẩm có thêm `flower_species: string[]`: tối đa 20 tên, mỗi tên 1 đến 150 ký tự sau chuẩn hóa, bỏ tên trùng không phân biệt hoa/thường. PATCH không gửi trường này thì giữ nguyên, gửi `[]` thì xóa liên kết, `null` không hợp lệ.

Trong **Quản lý → Sản phẩm**, nhập tên khoa học không kèm tác giả (lấy từ kết quả nhận diện) vào ô **Loài hoa**. Một bó hoa có thể gắn nhiều loài. Với tên lai, nhập đúng như Pl@ntNet trả về, kể cả ký hiệu `×`.

## 6. Mô hình dữ liệu

Bảng `flower_identifications`:

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID | Khóa chính, `gen_random_uuid()` |
| `user_id` | UUID | FK `users(id)`, `ON DELETE CASCADE` |
| `scientific_name` | VARCHAR(255) | Loài điểm cao nhất |
| `vietnamese_name` | VARCHAR(255) | Tên Việt lấy từ Wikipedia, có thể rỗng |
| `common_names` | JSONB | Tên thông dụng tiếng Anh từ Pl@ntNet |
| `family` | VARCHAR(255) | Họ thực vật |
| `score` | NUMERIC(6,5) | 0 đến 1 |
| `description` | JSONB | `{ "vi": "...", "en": "..." }` từ Wikipedia |
| `candidates` | JSONB | Mảng tối đa 3 ứng viên: tên khoa học, tên thông dụng, họ, điểm |
| `image_key` | VARCHAR(255) | Key ảnh trong storage, `NULL` nếu lưu ảnh lỗi. Không bao giờ trả ra client |
| `created_at` | TIMESTAMPTZ | Thời điểm nhận diện |

Index `(user_id, created_at DESC)` phục vụ danh sách lịch sử.

### 6.1. Lưu trữ ảnh

- Key có dạng `flower-identifications/<user_id>/<uuid>.<jpg|png>`.
- `UPLOAD_STORAGE=minio` (mặc định khi chạy Compose): lưu trong bucket `MINIO_BUCKET` dưới prefix trên. Route công khai `/uploads/:fileName` chỉ nhận tên file ở gốc bucket, nên không lộ được ảnh này.
- `UPLOAD_STORAGE=local`: lưu trong `PRIVATE_UPLOAD_DIR` (mặc định `private-uploads`), tách khỏi `UPLOAD_DIR` vì thư mục đó được `express.static` phục vụ công khai.
- Lưu ảnh lỗi thì vẫn lưu kết quả với `image_key = NULL`. Lưu bản ghi lỗi thì ảnh vừa lưu bị xóa ngay, không để file mồ côi.
- Xóa tài khoản xóa bản ghi theo `ON DELETE CASCADE`, nhưng file ảnh trong storage chưa được dọn tự động.

Lưu ý: `vietnamese_name` lưu tên lấy từ Wikipedia lúc nhận diện. Tên từ bảng soạn sẵn ở frontend không được lưu, nên khi hiển thị lại lịch sử cần gọi `flowerDisplayName()` với bản ghi để có cùng tên như lúc nhận diện.

## 7. Giao diện

- **Mở popup:** bấm icon máy ảnh trong ô tìm kiếm trên header. URL `/?identify=flower` cũng mở popup. Chưa đăng nhập thì hiện nút đăng nhập, sau đăng nhập quay lại popup.
- **Cột trái:**
  - Khung Chọn ảnh khi chưa có ảnh. Khi đã có ảnh thì bấm vào ảnh xem trước để đổi ảnh.
  - Hàng nút gồm icon camera (chụp ảnh) bên trái và nút Nhận diện hoa.
  - Camera cần HTTPS hoặc localhost. Đóng popup sẽ tắt camera, hủy request và xóa ảnh xem trước.
- **Cột phải:** một kết quả gồm:
  - tên Việt, tên khoa học, chip họ;
  - thanh độ phù hợp có màu theo mức;
  - mục Ý nghĩa hoặc Giới thiệu.
  - Các phần ngăn bằng đường kẻ mảnh, không lồng khung.
- **Dưới kết quả:** dòng "Đã lưu" khi lần nhận diện đã vào lịch sử. Popup không hiển thị sản phẩm gợi ý.
- **Tab Lịch sử:** thanh chuyển tab Nhận diện / Lịch sử ở đầu popup.
  - Danh sách mới nhất trước, mỗi dòng có ảnh thu nhỏ, tên, tên khoa học, độ phù hợp theo màu, thời gian và nút xóa. Tải 10 bản ghi mỗi lần, có nút Xem thêm.
  - Bấm một dòng để xem lại ảnh gốc và thẻ kết quả đầy đủ, kèm các loài gần giống và nút xóa.
  - Nút Xóa tất cả có hộp xác nhận. Lịch sử trống thì có nút quay lại Nhận diện.
  - Chuyển sang tab Lịch sử sẽ tắt camera. Ảnh và kết quả ở tab Nhận diện vẫn được giữ.
- **File chính:**
  - `shop-web/src/features/customer/components/FlowerIdentifier.jsx` và `.css`
  - `FlowerMatch.jsx` (thẻ kết quả dùng chung), `FlowerHistory.jsx` (tab Lịch sử), `FlowerHistoryImage.jsx` (tải ảnh riêng tư)
  - `HeaderSearch.jsx`
  - `shop-web/src/shared/utils/flowerNames.js`
  - `shop-web/src/shared/api/flowers.service.ts`

## 8. Kiểm thử

- **Unit backend, không cần DB:**
  ```bash
  cd shop-api
  node --test tests/flower-identification.test.js tests/flower-description.test.js tests/flower-history.test.js
  ```
  Các test bao phủ:
  - kiểm tra ảnh và map kết quả Pl@ntNet;
  - tra Wikipedia: tên từ tiêu đề, câu đầu, bài của chi, lược câu phân loại học, bỏ trang định hướng, tạm dừng khi 429;
  - lịch sử: tự lưu khi nhận diện, lỗi lưu không làm hỏng nhận diện, phân quyền theo chủ sở hữu, kiểm tra id và phân trang.
- **Integration catalog:** đặt `FLOWER_TEST_DATABASE_URL` trỏ tới database riêng tên `flower_test`, chạy `node --test tests/flower-catalog.integration.test.js`. Không dùng database thật.
- **Frontend:** `npm run build`, `npm run lint`.
- **Thủ công:**
  - Đăng nhập, chụp/tải ảnh, nhận diện.
  - Kiểm tra `GET /flowers/history` có bản ghi mới, xóa một bản ghi, xóa toàn bộ.
  - Đăng nhập tài khoản khác, xác nhận không đọc được lịch sử của người kia.
- Độ chính xác chỉ nghiệm thu được bằng API key thật và ảnh hoa đã biết tên. Mock chỉ kiểm tra tích hợp.

## 9. Giới hạn

- **Mỗi ảnh một loài chính.** Ảnh nhiều loài hoa có thể cho kết quả lẫn lộn.
- **Ý nghĩa biểu tượng chỉ có cho khoảng 30 chi** trong bảng soạn sẵn. Các loài khác dùng đoạn giới thiệu thực vật học từ Wikipedia, có bài khá ngắn.
- **Có thể không có tên Việt.** Nếu Wikipedia tiếng Việt không có tên cho cả loài lẫn chi (ví dụ `Osteospermum ecklonis`), giao diện hiện tên khoa học.
- **Rate limiter và cache Wikipedia nằm trong RAM,** reset khi restart và chỉ đúng khi chạy một instance. Chạy nhiều instance thì cần kho dùng chung.
- **Lịch sử chưa có giới hạn số bản ghi** hay dung lượng ảnh mỗi tài khoản. Ảnh lưu nguyên bản, tối đa 10 MB mỗi ảnh.
- **Xóa tài khoản chưa dọn file ảnh** trong storage (bản ghi DB thì đã bị xóa).
- **Sản phẩm chưa gắn loài,** hoặc gắn tên đồng nghĩa, sẽ không được gợi ý.

Nguồn:
- https://my.plantnet.org/doc/api/identify
- https://meta.wikimedia.org/wiki/User-Agent_policy
