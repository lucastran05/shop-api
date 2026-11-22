# Bloomora Moments — Discovery & Worlds

Bloomora Moments gồm hai luồng:

- **Discover** tạo tối đa ba rail theo ngày lễ, mùa và sở thích đã được người dùng đồng ý lưu.
- **Worlds** phân tích một câu tiếng Việt, lấy sản phẩm active/còn hàng từ PostgreSQL và xếp hạng bằng metadata nội bộ. Provider AI không tạo ID, giá, tồn kho hay ảnh sản phẩm.

Frontend nằm trong repo `shop-web`, route `/kham-pha`. Backend nằm trong repo này, dưới `/api/v1/discovery`.

## Chạy từ hai repository mới clone

Đặt hai repo cạnh nhau:

```text
workspace/
  shop-api/
  shop-web/
```

Trong `shop-api`, sao chép `.env.example` thành `.env`, thay `DB_PASSWORD`, `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` bằng giá trị local đủ mạnh. API key AI là tùy chọn. Sau đó chạy:

```powershell
cd shop-api
docker compose -f compose.discovery.yaml up -d --build --wait
```

Mặc định website ở `http://localhost:18080/kham-pha`, Mailpit ở `http://localhost:18025`. Có thể đổi hai host port bằng `BLOOMORA_WEB_PORT` và `BLOOMORA_MAILPIT_PORT` trong `.env`.

Nếu dự án nhóm đã có Compose ở thư mục cha, tiếp tục dùng Compose đó. Các biến AI phải được truyền vào service `api`; không đưa chúng vào Vite/React.

## Cấu hình AI

| Provider | Biến môi trường | Model mặc định | Vai trò |
| --- | --- | --- | --- |
| Gemini | `GEMINI_API_KEY`, `DISCOVERY_GEMINI_MODEL` | `gemini-3.5-flash-lite` | Provider chính, structured output, validate schema. |
| Groq | `GROQ_API_KEY`, `DISCOVERY_GROQ_MODEL` | `openai/gpt-oss-20b` | Dự phòng khi Gemini lỗi tạm thời, quota hoặc response không hợp lệ. |
| Cohere | `COHERE_API_KEY`, `DISCOVERY_COHERE_MODEL`, `DISCOVERY_EVALUATE_COHERE` | `rerank-v5.0-fast`, cờ `0` | Chỉ đánh giá offline; không được gọi trong request khách hàng. |

Không có key nào là bắt buộc. Nếu Gemini và Groq không khả dụng, Worlds trả `mode=fallback` và dùng intent/ranking nội bộ. Lỗi credentials, model hoặc request sai không bị retry qua vòng lặp. Mỗi provider chỉ nhận câu nhập hiện tại; lịch sử, tài khoản và toàn bộ catalog không được gửi đi.

Chạy diagnostic từ PowerShell ở `shop-api`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\discovery-host-diagnostic.ps1
```

Diagnostic gọi tối đa một request/provider, báo model, HTTP status, loại lỗi, latency và validation; không in key, Authorization header, raw request hoặc raw model output. Cohere chỉ rerank tối đa năm ứng viên trong diagnostic và vẫn không được bật cho traffic thật.

## Dữ liệu và migration

`src/modules/discovery/migrations/001_up.sql` tạo ba bảng riêng:

- `discovery_preferences`
- `discovery_occasions`
- `discovery_interactions`

Migration chạy idempotent sau `initDB`. `001_down.sql` chỉ dùng rollback thủ công và không chạy khi startup. Interaction quá 90 ngày được dọn khi khởi động và mỗi 24 giờ.

Discovery đọc catalog chung, giới hạn tối đa 500 sản phẩm active, public, còn hàng và có giá dương. Một database mới có thể chạy module với catalog rỗng; UI sẽ trả empty state hợp lệ.

### Seed demo tùy chọn

Repo có sẵn catalog và ảnh demo cơ bản trong `scripts/demo-data`. Lệnh plan không ghi database:

```powershell
docker compose -f compose.discovery.yaml exec -T `
  -e DISCOVERY_LOCAL_SEED=1 api `
  node src/modules/discovery/seed-local.js --plan
```

Lệnh seed chỉ chạy khi `DISCOVERY_LOCAL_SEED=1`, `CLIENT_URL` là localhost và storage là local:

```powershell
docker compose -f compose.discovery.yaml exec -T `
  -e DISCOVERY_LOCAL_SEED=1 api `
  node src/modules/discovery/seed-local.js
```

Có thể bổ sung ảnh `hoa-*.png` bằng cách mount một thư mục read-only và đặt `DISCOVERY_SEED_IMAGE_DIR`. Thư mục ngoài này không bắt buộc. Seed dùng marker `bloomora_discovery_demo_v1`, bỏ qua bản ghi đã có và không tự chạy khi API startup.

## API và consent

| Endpoint | Quyền | Tác dụng |
| --- | --- | --- |
| `GET /rails` | Công khai, auth tùy chọn | Discover rails theo ngữ cảnh và consent. |
| `POST /interpret` | Công khai, auth tùy chọn | Phân tích câu 2–500 ký tự và trả Worlds. |
| `POST /refine` | Công khai, auth tùy chọn | Xếp hạng lại theo sắc thái, không gọi LLM. |
| `GET/PUT /preferences` | Đăng nhập | Đọc/lưu consent, màu và phong cách. |
| `POST /feedback` | Đăng nhập + consent | Lưu tương tác Discovery hợp lệ. |
| `DELETE /history` | Đăng nhập | Xóa lịch sử Discovery. |

Khi consent tắt, màu/phong cách đã lưu và interaction bị xóa trong transaction; ranking không dùng dữ liệu cá nhân hóa. Màu được nói trực tiếp trong prompt có ưu tiên cao hơn màu yêu thích.

## Kiểm thử

```powershell
npm test
```

Kiểm thử Discovery riêng:

```powershell
node --test tests/discovery.test.js tests/discovery-http.test.js
```

Integration test chỉ chạy với PostgreSQL tách biệt và bắt buộc database tên `discovery_test`:

```powershell
$env:DISCOVERY_TEST_DATABASE_URL='postgresql://postgres:password@localhost:5432/discovery_test'
node --test tests/discovery.integration.test.js
```

Không trỏ integration test vào database đang dùng cho demo hoặc production.

## Bảo mật

- `.env` bị Git ignore; `.env.example` chỉ chứa placeholder.
- Provider keys chỉ được backend đọc từ environment.
- Diagnostic lọc key, Authorization và nội dung model có thể phản chiếu dữ liệu người dùng.
- Cohere mặc định tắt (`DISCOVERY_EVALUATE_COHERE=0`) và chưa nối vào live service.
- Không commit database dump, uploads runtime hoặc ảnh chứa dữ liệu cá nhân.
