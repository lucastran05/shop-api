// Kiểu giấy gói và dáng bó cho "Tự tạo bó hoa".
// Đây là nguồn dữ liệu duy nhất: frontend lấy qua CART06 nên không khai lại bảng giá ở web.
import { BadRequestError } from '../../common/errors/AppError.js';

// price là phụ phí một bó, cộng vào giá bó sau tiền hoa
export const BOUQUET_WRAPS = [
  { id: 'kraft', name: 'Giấy kraft mộc', price: 0, colors: ['#d8c3a0', '#bb9f74'], description: 'Giấy nâu mộc, hợp mọi loại hoa' },
  { id: 'pastel', name: 'Giấy pastel', price: 15000, colors: ['#f3dfe6', '#e3bccb'], description: 'Giấy hồng phấn nhẹ nhàng' },
  { id: 'mint', name: 'Giấy bạc hà', price: 15000, colors: ['#d8e7d6', '#aec9ad'], description: 'Xanh bạc hà mát mắt' },
  { id: 'silk', name: 'Lụa Hàn Quốc', price: 30000, colors: ['#efe6f4', '#c6abd9'], description: 'Lụa mềm, ánh nhẹ, gói sang trọng' },
  { id: 'mesh', name: 'Lưới voan', price: 20000, colors: ['#f6f2e6', '#ddd2b8'], description: 'Voan mỏng, nhìn xuyên thấy hoa' },
];

// scale: hệ số chiều cao bó dùng cho ảnh xem trước; spread: độ xòe của các cành
export const BOUQUET_HEIGHTS = [
  { id: 'low', name: 'Thấp, xòe rộng', scale: 0.86, spread: 1.3 },
  { id: 'medium', name: 'Vừa', scale: 1, spread: 1 },
  { id: 'tall', name: 'Cao, vươn thẳng', scale: 1.16, spread: 0.72 },
];

// Chiều dài cành khách yêu cầu cắt (cm), đặt riêng cho từng loại hoa trong bó.
// Không ảnh hưởng giá, chỉ là yêu cầu gói.
export const STEM_LENGTH = { min: 40, max: 70, step: 5, default: 50 };

export const DEFAULT_WRAP = BOUQUET_WRAPS[0].id;
export const DEFAULT_HEIGHT = 'medium';

export const findWrap = (id) => BOUQUET_WRAPS.find((wrap) => wrap.id === id);
export const findHeight = (id) => BOUQUET_HEIGHTS.find((height) => height.id === id);

export function normalizeStemLength(value) {
  if (value === undefined || value === null || value === '') return STEM_LENGTH.default;
  const length = Number(value);
  if (!Number.isFinite(length) || !Number.isInteger(length)) {
    throw new BadRequestError('Chiều dài cành phải là số nguyên (cm)');
  }
  if (length < STEM_LENGTH.min || length > STEM_LENGTH.max || (length - STEM_LENGTH.min) % STEM_LENGTH.step !== 0) {
    throw new BadRequestError(
      `Chiều dài cành phải từ ${STEM_LENGTH.min} đến ${STEM_LENGTH.max} cm, cách nhau ${STEM_LENGTH.step} cm`,
    );
  }
  return length;
}

// Kiểu gói khách gửi lên; thiếu thì dùng mặc định, sai thì báo lỗi chứ không im lặng bỏ qua
export function normalizeBouquetStyle({ wrap, height } = {}) {
  const wrapId = wrap === undefined || wrap === null || wrap === '' ? DEFAULT_WRAP : wrap;
  const heightId = height === undefined || height === null || height === '' ? DEFAULT_HEIGHT : height;
  if (!findWrap(wrapId)) throw new BadRequestError('Kiểu giấy gói không hợp lệ');
  if (!findHeight(heightId)) throw new BadRequestError('Dáng bó hoa không hợp lệ');
  return { wrap: wrapId, height: heightId };
}

// Phụ phí giấy gói của một bó
export const wrapPrice = (wrapId) => Number(findWrap(wrapId)?.price) || 0;

// Thông tin kiểu gói trả cho FE (tên để hiển thị ở giỏ, đơn hàng và phiếu gói)
export function describeBouquetStyle(style) {
  const { wrap, height } = normalizeBouquetStyle(style);
  return {
    wrap,
    wrap_name: findWrap(wrap).name,
    wrap_price: wrapPrice(wrap),
    height,
    height_name: findHeight(height).name,
  };
}
