# Chatbot hoa qua backend Gemini

Frontend gọi `POST /api/v1/chatbot/message`. API key chỉ nằm ở server.

## Cấu hình

Trong `BTL/.env` khi dùng Docker, hoặc `shop-api/.env` khi chạy Node:

```dotenv
GEMINI_API_KEY=your-real-key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Sau khi đổi cấu hình: `docker compose up -d --build --wait api`.
Không đặt key trong VITE_, frontend, URL hoặc tin nhắn. Không commit key.

## Hai chế độ trả lời

1. Tư vấn hoa tự nhiên (`flower_conversation`): Gemini tự viết câu trả lời theo câu hỏi,
   dùng kiến thức chung về các loại hoa, không giới hạn 30 mẫu trong shop. Hỏi 20/11 chỉ
   trả lời 20/11. Không tự liệt kê SKU, giá, tồn kho, lịch tháng hoặc nhãn nguồn hệ thống.
   Không truy vấn/gửi danh mục cho lượt tư vấn này. Model được yêu cầu không đưa ra
   khẳng định về shop, không bịa nguồn, nói rõ khi không chắc. Đây là câu trả lời LLM,
   không phải bảo đảm mọi kiến thức đều chính xác.
2. Yêu cầu sản phẩm/giá cụ thể: Gemini chọn ID bằng structured output; server kiểm tra
   ID và lọc dữ liệu DB theo ngân sách, tháng/mùa, tồn kho, màu/loại hoa cần tránh.
   Đơn hàng luôn lọc user_id từ JWT; voucher lọc đúng người nhận, hiệu lực và lượt còn lại.

Lời gọi “bên shop có thể gợi ý loại hoa…” là yêu cầu tư vấn, không mặc định là hỏi tồn kho.
Các trường mode: flower_conversation, grounded, advice_fallback, catalog_fallback, unavailable.
Khi Gemini lỗi, câu hỏi có hướng dẫn dự phòng được trả lời bằng nội dung biên tập và ghi rõ
chế độ dự phòng. Không giả vờ đã gọi AI thành công; không tạo giá hoặc ưu đãi.

## API

```json
{"message":"Gợi ý hoa tặng thầy cô ngày 20/11","history":[{"role":"user","text":"Mình muốn tặng cô giáo"}]}
```

Tối đa 1000 ký tự/tin, 6 tin lịch sử user, 12 request/phút/IP (bộ nhớ một instance).
Response: `{status:"success",data:{answer,sources,mode,action?,checkedAt?}}`.
History không phải nguồn sự thật của shop; không nhận system prompt từ client.
Không đưa JWT, khóa API hoặc dữ liệu tài khoản vào prompt. Chỉ giữ mã lỗi/loại lỗi trong log.

## Danh mục mẫu và giao diện

`docker compose exec -T api node scripts/seed-flowers.js` thêm 30 mẫu/60 biến thể bằng
transaction và ID ổn định. Chạy lại không ghi đè bản ghi hiện có. Giá/tồn kho demo;
ảnh SVG minh họa ở `shop-web/public/flowers`; mùa/tháng là bộ sưu tập gợi ý, không cam kết nguồn cung.

Giữ cấu trúc component hiện có. Ô nhập hai dòng, tự cuộn; Enter gửi, Shift+Enter xuống dòng.
Không còn nút câu hỏi soạn sẵn. Luồng Chat với shop vẫn độc lập.

## Kiểm tra

`node --test tests/chatbot.test.js tests/flower-advisor.test.js tests/flower-conversation.test.js`

Có kiểm tra phân biệt tư vấn và danh mục, hỏi 20/11 không lạc sang dịp khác khi fallback,
quyền truy cập đơn, schema, budget/tháng/mùa, loại trừ hoa và lỗi Gemini 429/504.
Test giả lập không thay thế kiểm tra Gemini thực tế.
