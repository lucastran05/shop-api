# 07. THANH TOÁN QR VÀ THẺ (PAYMENTS)
> **Mã phân hệ:** `PAY` / `SYS`  
> **Phạm vi:** Khách hàng, Cổng thanh toán (Webhook)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Quản lý chu kỳ thanh toán trực tuyến của đơn hàng thông qua VietQR, MoMo và Thẻ tín dụng/ghi nợ:
- **Quy tắc nghiệp vụ:**
  - Khách hàng không thể tùy tiện gửi dữ liệu "đã thanh toán". Mọi thanh toán đều phải qua **Phiên thanh toán (`PAY01`)** có thời hạn (thường 15 phút).
  - Mục đích thanh toán (`purpose`): Có thể là `deposit` (thanh toán cọc) hoặc `full` (thanh toán đủ toàn bộ).
  - `PAY01` sinh mã `qr_payload` chuẩn VietQR hoặc liên kết thanh toán `payment_url`.
  - Frontend kiểm tra tiến độ thanh toán định kỳ (polling) bằng `PAY02`.
  - Cổng thanh toán gọi **Webhook (`SYS01`)** để tự động cập nhật trạng thái đơn sang đã thanh toán cọc/đã thanh toán đủ.

---

## 2. Thông tin chung

- **Base URL:** `/api/v1/orders/:order_id/payment-sessions` và `/api/v1/payments`
- **Quyền hạn truy cập:**
  - `PAY01`, `PAY02`: Khách hàng đã đăng nhập (`Customer`).
  - `SYS01`: Hệ thống bên ngoài có chữ ký bảo mật (`Webhook Secret`).

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **PAY01** | `POST` | `/api/v1/orders/:order_id/payment-sessions` | Customer | Tạo phiên thanh toán mới (VietQR, MoMo, Thẻ) |
| **PAY02** | `GET` | `/api/v1/payments/:payment_id` | Customer | Tra cứu trạng thái phiên thanh toán và đơn hàng |
| **SYS01** | `POST` | `/api/v1/payments/webhook` | Webhook / Gateway | Tiếp nhận thông báo thanh toán thành công từ cổng |

---

## 4. Chi tiết từng Endpoint

### 4.1. PAY01 — Tạo phiên thanh toán đơn hàng
- **Method:** `POST`
- **Path:** `/api/v1/orders/:order_id/payment-sessions`
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: uuid-v4`

#### Request Body
```json
{
  "method": "vietqr",
  "purpose": "deposit"
}
```

#### Responses Mẫu
- **`201 Created`**:
```json
{
  "status": "success",
  "data": {
    "id": "pay_session_12345",
    "order_id": "ord-771122",
    "purpose": "deposit",
    "method": "vietqr",
    "provider": "vietcombank",
    "status": "pending",
    "amount": 993000,
    "currency": "VND",
    "qr_payload": "00020101021238580010A000000727012800069704360114...",
    "qr_image_url": "https://img.vietqr.io/image/970436-123456789-compact.png?amount=993000&addInfo=ORD20261013001",
    "payment_url": null,
    "expires_at": "2026-10-13T09:46:00.000Z",
    "paid_at": null,
    "failure_code": null,
    "created_at": "2026-10-13T09:31:00.000Z"
  }
}
```

---

### 4.2. PAY02 — Tra cứu trạng thái phiên thanh toán
- **Method:** `GET`
- **Path:** `/api/v1/payments/:payment_id`
- **Headers:** `Authorization: Bearer <token>`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "id": "pay_session_12345",
    "order_id": "ord-771122",
    "purpose": "deposit",
    "method": "vietqr",
    "provider": "vietcombank",
    "status": "succeeded",
    "amount": 993000,
    "currency": "VND",
    "expires_at": "2026-10-13T09:46:00.000Z",
    "paid_at": "2026-10-13T09:35:12.000Z",
    "failure_code": null,
    "order": {
      "id": "ord-771122",
      "payment_status": "partially_paid",
      "deposit_status": "paid",
      "deposit_paid_at": "2026-10-13T09:35:12.000Z",
      "paid_amount": 993000,
      "remaining_amount": 2317000
    }
  }
}
```

---

### 4.3. SYS01 — Webhook tiếp nhận thanh toán
- **Method:** `POST`
- **Path:** `/api/v1/payments/webhook`
- **Headers:** `X-Signature: sha256_hmac_signature_here`

#### Request Body
```json
{
  "payment_id": "pay_session_12345",
  "transaction_reference": "VCB_TXN_998877",
  "amount": 993000,
  "status": "PAID"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Webhook processed successfully"
}
```
