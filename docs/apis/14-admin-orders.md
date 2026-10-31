# 14. QUẢN TRỊ ĐƠN HÀNG (ADMIN ORDERS)
> **Mã phân hệ:** `ADO`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Theo dõi, lọc tìm đơn hàng, duyệt trạng thái tiến trình, cập nhật thông tin đối tác giao hàng và mã vận đơn:
- **Quy tắc nghiệp vụ:**
  - `ADO01` hỗ trợ chế độ xem đặc biệt `view=payments` để đồng bộ dữ liệu cho màn hình đối soát thanh toán.
  - Quản lý trạng thái chuyển đổi hợp lệ (`allowed_next_statuses`): Trả về các trạng thái kế tiếp mà đơn hàng được phép chuyển đổi sang (ví dụ: `pending -> processing -> shipped -> delivered`).
  - Cập nhật vận chuyển (`ADO03`): Cho phép cập nhật đơn vị vận chuyển (`carrier`), mã vận đơn (`tracking_number`) và ghi chú nội bộ.
  - Đối với đơn nhận tại cửa hàng (`pickup`), không bắt buộc nhập mã vận đơn.

---

## 2. Thông tin chung

- **Base URL:** `/admin/orders`
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **ADO01** | `GET` | `/admin/orders` | Manager / Admin | Danh sách đơn hàng toàn hệ thống, tìm theo mã/tên/email |
| **ADO02** | `GET` | `/admin/orders/:id` | Manager / Admin | Chi tiết đơn hàng, danh sách trạng thái tiếp theo hợp lệ |
| **ADO03** | `PATCH` | `/admin/orders/:id` | Manager / Admin | Đổi trạng thái đơn hàng và cập nhật mã vận đơn giao hàng |

---

## 4. Chi tiết từng Endpoint

### 4.1. ADO01 — Danh sách đơn hàng quản trị
- **Method:** `GET`
- **Path:** `/admin/orders`
- **Query Parameters:** `keyword=ORD-2026&status=processing&page=1&limit=10`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "ord-771122",
      "code": "ORD-20261013-001",
      "status": "processing",
      "status_label": "Đang chuẩn bị hàng",
      "payment_status": "partially_paid",
      "deposit_status": "paid",
      "deposit_paid_at": "2026-10-13T09:35:12.000Z",
      "total_amount": 3310000,
      "deposit_amount": 993000,
      "paid_amount": 993000,
      "refunded_amount": 0,
      "held_amount": 0,
      "remaining_amount": 2317000,
      "created_at": "2026-10-13T09:31:00.000Z",
      "customer": {
        "id": "e4f5a342-990a-4712-881b-50dae4bfa350",
        "name": "Nguyễn Văn A",
        "email": "nguyenvana@example.com"
      },
      "recipient_name": "Nguyễn Văn A",
      "payment_method": "vietqr",
      "allowed_actions": ["update_status", "confirm_payment", "refund"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 4.2. ADO03 — Chuyển trạng thái đơn và gán vận đơn
- **Method:** `PATCH`
- **Path:** `/admin/orders/:id`

Để giao hàng nhanh từ `confirmed`, `processing` hoặc `packed`, gửi `status: "shipping"` cùng `carrier` và `tracking_number` (bắt buộc). Đơn `shipping` có thể chuyển sang `delivered` hoặc `returned`; hoàn hàng yêu cầu `note` có lý do. Cập nhật vận chuyển và trạng thái được lưu trong cùng giao dịch.

#### Request Body
```json
{
  "status": "shipping",
  "carrier": "Giao Hàng Tiết Kiệm (GHTK)",
  "tracking_number": "S2026.GHTK.998811",
  "note": "Đã bàn giao cho shipper lúc 14h00"
}
```

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "message": "Cập nhật đơn hàng thành công",
  "data": {
    "id": "ord-771122",
    "code": "ORD-20261013-001",
    "status": "shipping",
    "status_label": "Đang giao hàng",
    "shipment": {
      "carrier": "Giao Hàng Tiết Kiệm (GHTK)",
      "tracking_number": "S2026.GHTK.998811",
      "shipped_at": "2026-10-13T10:00:00.000Z",
      "delivered_at": null
    },
    "allowed_next_statuses": [
      { "code": "delivered", "label": "Đã giao hàng thành công" },
      { "code": "packed", "label": "Về đã đóng gói" },
      { "code": "returned", "label": "Hoàn hàng" }
    ]
  }
}
```
