# 15. XÁC NHẬN THU TIỀN VÀ HOÀN TIỀN (ADMIN PAYMENTS)
> **Mã phân hệ:** `ADY`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Xử lý đối soát thanh toán thủ công, xác nhận tiền vào tài khoản và thực hiện lệnh hoàn tiền cho khách hàng:
- **Quy tắc nghiệp vụ:**
  - `ADY01`: Xác nhận thu tiền thủ công (chuyển khoản ngân hàng trực tiếp hoặc tiền mặt thu tại shop).
    - `kind`: Có thể là `deposit` (thu cọc) hoặc `full` (thu đủ toàn bộ/thu phần còn lại).
    - Tự động cộng dồn vào `paid_amount`, cập nhật `remaining_amount` và chuyển `payment_status` tương ứng.
  - `ADY02`: Hoàn tiền (`refunds`).
    - Số tiền hoàn (`amount`) không được vượt quá số tiền khách đã thực tế thanh toán (`paid_amount`).
    - Tự động cộng vào `refunded_amount` và ghi nhận lịch sử giao dịch hoàn tiền.
  - Bắt buộc truyền `Idempotency-Key` để tránh ghi nhận giao dịch thu/hoàn tiền 2 lần.

---

## 2. Thông tin chung

- **Base URL:** `/admin/orders/:order_id/payment-confirmations` và `/admin/orders/:order_id/refunds`
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **ADY01** | `POST` | `/admin/orders/:id/payment-confirmations` | Manager / Admin | Xác nhận đã thu cọc hoặc đã thu đủ tiền |
| **ADY02** | `POST` | `/admin/orders/:id/refunds` | Manager / Admin | Ghi nhận hoàn tiền cho khách hàng |

---

## 4. Chi tiết từng Endpoint

### 4.1. ADY01 — Xác nhận thu tiền
- **Method:** `POST`
- **Path:** `/admin/orders/:order_id/payment-confirmations`
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: uuid-v4`

#### Request Body
```json
{
  "kind": "full",
  "amount": 2317000,
  "transaction_reference": "VCB-BANK-009988",
  "note": "Khách chuyển khoản số tiền còn lại sau khi nhận hàng"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Xác nhận thu tiền thành công",
  "data": {
    "id": "conf-8899",
    "order_id": "ord-771122",
    "kind": "full",
    "amount": 2317000,
    "transaction_reference": "VCB-BANK-009988",
    "status": "confirmed",
    "confirmed_by": "Quản Trị Kế Toán",
    "confirmed_at": "2026-10-13T10:15:00.000Z",
    "order": {
      "id": "ord-771122",
      "code": "ORD-20261013-001",
      "status": "completed",
      "status_label": "Hoàn thành",
      "payment_status": "paid",
      "deposit_status": "paid",
      "total_amount": 3310000,
      "paid_amount": 3310000,
      "remaining_amount": 0
    }
  }
}
```

---

### 4.2. ADY02 — Hoàn tiền đơn hàng
- **Method:** `POST`
- **Path:** `/admin/orders/:order_id/refunds`
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: uuid-v4`

#### Request Body
```json
{
  "amount": 993000,
  "reason": "Khách hủy đơn do hết mẫu bàn phím mong muốn",
  "transaction_reference": "REFUND-VCB-7722"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Hoàn tiền thành công",
  "data": {
    "id": "ref-1122",
    "order_id": "ord-771122",
    "amount": 993000,
    "status": "completed",
    "reason": "Khách hủy đơn do hết mẫu bàn phím mong muốn",
    "transaction_reference": "REFUND-VCB-7722",
    "completed_at": "2026-10-13T10:20:00.000Z",
    "order": {
      "id": "ord-771122",
      "code": "ORD-20261013-001",
      "status": "cancelled",
      "refunded_amount": 993000,
      "remaining_amount": 0
    }
  }
}
```
