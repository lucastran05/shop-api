# Dữ liệu địa giới Việt Nam

Nguồn: [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database/tree/8b78ba5118715e1fa81769286724db79346abf52/json).

- File gốc: `json/vn_only_simplified_json_generated_data_vn_units.json`.
- Commit: `8b78ba5118715e1fa81769286724db79346abf52`.
- Ngày lấy dữ liệu: 2026-10-31.
- Tổng cộng: 34 tỉnh/thành và 3.321 xã/phường/đặc khu.
- Giấy phép MIT của nguồn được giữ trong file `LICENSE` cùng thư mục.

`locations.json` giữ nguyên mã dạng chuỗi và tên đầy đủ của nguồn. Các trường được đổi tên để tương thích API hiện tại: `Code` → `code`, `FullName` → `name`, `ProvinceCode` → `province_code`. Bỏ các trường mã bưu chính không dùng; làm phẳng `Wards` thành danh sách `wards`.

Backend đọc bản dữ liệu cục bộ, không gọi GitHub lúc chạy. Khi cập nhật, lấy dữ liệu tại một commit cụ thể, chuyển đổi theo mapping trên và cập nhật thông tin nguồn. Sau đó kiểm tra thủ công số tỉnh, số xã, mã duy nhất và quan hệ tỉnh/xã trước khi đưa vào sử dụng.

Thay danh mục không tự đổi mã hay tên của địa chỉ đã lưu trong cơ sở dữ liệu. Địa chỉ cũ cần được người dùng chọn lại đơn vị hành chính hiện tại khi chỉnh sửa.
