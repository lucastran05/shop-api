# 17. DASHBOARD VÀ BÁO CÁO DOANH THU (DASHBOARD & REPORTS)
> **Mã phân hệ:** `DSH` / `REP`  
> **Phạm vi:** Quản trị viên (`admin`), Quản lý (`manager`)  
> **Cập nhật:** 2026-10-13  

---

## 1. Giới thiệu phân hệ & Nghiệp vụ

Cung cấp các chỉ số tổng hợp thời gian thực của cửa hàng và các báo cáo doanh thu kinh doanh theo chu kỳ:
- **Quy tắc nghiệp vụ:**
  - `DSH01`: Tổng hợp doanh thu, doanh thu trong ngày (`today_revenue`), số đơn hàng mới cần xử lý (`pending_order_count`), số mặt hàng chạm ngưỡng tồn kho thấp (`low_stock_count`), phân bổ đơn theo trạng thái và danh sách đơn hàng gần đây nhất.
  - `REP01`: Thống kê doanh thu theo thời gian (ngày, tháng, quý, năm) hỗ trợ 2 định dạng:
    - `format=json`: Trả về dữ liệu JSON để vẽ biểu đồ và hiển thị bảng số liệu trên web.
    - `format=csv`: Xuất trực tiếp file CSV đính kèm để tải về máy tính mở bằng Excel/Google Sheets.

---

## 2. Thông tin chung

- **Base URL:** `/admin/dashboard` và `/admin/reports/sales`
- **Quyền hạn truy cập:** `Manager`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <access_token>`

---

## 3. Danh sách Endpoints tóm tắt

| Mã API | Method | Endpoint Path | Quyền hạn | Mô tả ngắn |
| :---: | :---: | :--- | :---: | :--- |
| **DSH01** | `GET` | `/admin/dashboard` | Manager / Admin | Thẻ số liệu tổng quan, số đơn theo trạng thái và đơn gần đây |
| **REP01** | `GET` | `/admin/reports/sales` | Manager / Admin | Báo cáo doanh số bán hàng (JSON phân tích hoặc file CSV) |

---

## 4. Chi tiết từng Endpoint

### 4.1. DSH01 — Tổng quan số liệu Dashboard
- **Method:** `GET`
- **Path:** `/admin/dashboard`
- **Query Parameters:** `from=2026-10-01&to=2026-10-13&timezone=Asia/Ho_Chi_Minh`

#### Responses Mẫu
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "revenue": 125600000,
    "today_revenue": 8940000,
    "order_count": 84,
    "pending_order_count": 5,
    "low_stock_count": 3,
    "low_stock_threshold": 5,
    "status_counts": [
      { "status": "pending", "label": "Chờ xác nhận", "count": 5 },
      { "status": "processing", "label": "Đang chuẩn bị", "count": 12 },
      { "status": "shipped", "label": "Đang giao hàng", "count": 18 },
      { "status": "completed", "label": "Đã hoàn thành", "count": 45 },
      { "status": "cancelled", "label": "Đã hủy", "count": 4 }
    ],
    "recent_orders": [
      {
        "id": "ord-771122",
        "code": "ORD-20261013-001",
        "customer_name": "Nguyễn Văn A",
        "total_amount": 3310000,
        "status": "processing",
        "created_at": "2026-10-13T09:31:00.000Z"
      }
    ],
    "period": {
      "from": "2026-10-01T00:00:00.000Z",
      "to": "2026-10-13T23:59:59.000Z",
      "timezone": "Asia/Ho_Chi_Minh",
      "revenue_date_basis": "completed_at"
    }
  }
}
```

---

### 4.2. REP01 — Báo cáo doanh thu bán hàng
- **Method:** `GET`
- **Path:** `/admin/reports/sales`
- **Query Parameters:**
  - `year=2026` hoặc `from=2026-10-01&to=2026-10-13`
  - `group_by`: `day`, `month`, `quarter`
  - `format`: `json` (mặc định) hoặc `csv`

#### Responses Mẫu (khi `format=json`)
- **`200 OK`**:
```json
{
  "status": "success",
  "data": {
    "summary": {
      "order_count": 84,
      "completed_order_count": 45,
      "revenue": 125600000,
      "held_amount": 0,
      "refunded_amount": 2980000
    },
    "rows": [
      {
        "period_start": "2026-10-01",
        "period_end": "2026-10-01",
        "label": "01/10/2026",
        "order_count": 8,
        "completed_order_count": 6,
        "revenue": 15400000,
        "held_amount": 0,
        "refunded_amount": 0
      }
    ],
    "period": {
      "group_by": "day",
      "timezone": "Asia/Ho_Chi_Minh",
      "date_basis": "completed_at"
    }
  }
}
```

#### Responses Mẫu (khi `format=csv`)
- **Headers:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename=sales_report_2026.csv`
- **Body:**
```csv
period_start,period_end,label,order_count,completed_order_count,revenue,held_amount,refunded_amount
2026-10-01,2026-10-01,01/10/2026,8,6,15400000,0,0
```
