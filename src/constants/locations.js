// Danh mục tỉnh / thành phố và phường / xã chuẩn của Việt Nam
export const PROVINCES = [
  { code: '01', name: 'Thành phố Hà Nội' },
  { code: '79', name: 'Thành phố Hồ Chí Minh' },
  { code: '48', name: 'Thành phố Đà Nẵng' },
  { code: '31', name: 'Thành phố Hải Phòng' },
  { code: '92', name: 'Thành phố Cần Thơ' },
  { code: '46', name: 'Tỉnh Thừa Thiên Huế' },
  { code: '56', name: 'Tỉnh Khánh Hòa' },
  { code: '60', name: 'Tỉnh Lâm Đồng' },
  { code: '74', name: 'Tỉnh Bình Dương' },
  { code: '75', name: 'Tỉnh Đồng Nai' },
  { code: '77', name: 'Tỉnh Bà Rịa - Vũng Tàu' },
  { code: '49', name: 'Tỉnh Quảng Nam' },
  { code: '37', name: 'Tỉnh Ninh Bình' },
  { code: '22', name: 'Tỉnh Quảng Ninh' },
];

export const WARDS = [
  // Hà Nội
  { code: '00001', name: 'Phường Phúc Xá', province_code: '01' },
  { code: '00004', name: 'Phường Trúc Bạch', province_code: '01' },
  { code: '00006', name: 'Phường Vĩnh Phúc', province_code: '01' },
  { code: '00007', name: 'Phường Cống Vị', province_code: '01' },
  { code: '00008', name: 'Phường Liễu Giai', province_code: '01' },
  { code: '00037', name: 'Phường Hàng Bạc', province_code: '01' },
  { code: '00040', name: 'Phường Hàng Đào', province_code: '01' },
  { code: '00043', name: 'Phường Hàng Gai', province_code: '01' },
  { code: '00046', name: 'Phường Tràng Tiền', province_code: '01' },
  { code: '00070', name: 'Phường Khâm Thiên', province_code: '01' },
  { code: '00079', name: 'Phường Láng Hạ', province_code: '01' },
  { code: '00082', name: 'Phường Láng Thượng', province_code: '01' },
  { code: '00157', name: 'Phường Dịch Vọng', province_code: '01' },
  { code: '00160', name: 'Phường Dịch Vọng Hậu', province_code: '01' },

  // TP. Hồ Chí Minh
  { code: '26734', name: 'Phường Bến Nghé', province_code: '79' },
  { code: '26737', name: 'Phường Bến Thành', province_code: '79' },
  { code: '26740', name: 'Phường Cầu Kho', province_code: '79' },
  { code: '26743', name: 'Phường Cầu Ông Lãnh', province_code: '79' },
  { code: '26746', name: 'Phường Cô Giang', province_code: '79' },
  { code: '26749', name: 'Phường Đa Kao', province_code: '79' },
  { code: '26752', name: 'Phường Nguyễn Cư Trinh', province_code: '79' },
  { code: '26755', name: 'Phường Nguyễn Thái Bình', province_code: '79' },
  { code: '26758', name: 'Phường Phạm Ngũ Lão', province_code: '79' },
  { code: '26761', name: 'Phường Tân Định', province_code: '79' },
  { code: '27139', name: 'Phường Thảo Điền', province_code: '79' },
  { code: '27142', name: 'Phường An Phú', province_code: '79' },
  { code: '27436', name: 'Phường Tân Thuận Đông', province_code: '79' },
  { code: '27439', name: 'Phường Tân Thuận Tây', province_code: '79' },

  // Đà Nẵng
  { code: '20194', name: 'Phường Thạch Thang', province_code: '48' },
  { code: '20197', name: 'Phường Thanh Bình', province_code: '48' },
  { code: '20200', name: 'Phường Thuận Phước', province_code: '48' },
  { code: '20203', name: 'Phường Hòa Thuận Đông', province_code: '48' },
  { code: '20206', name: 'Phường Hòa Thuận Tây', province_code: '48' },
  { code: '20209', name: 'Phường Nam Dương', province_code: '48' },
  { code: '20227', name: 'Phường Mỹ An', province_code: '48' },
  { code: '20230', name: 'Phường Khuê Mỹ', province_code: '48' },

  // Hải Phòng
  { code: '10972', name: 'Phường Hoàng Văn Thụ', province_code: '31' },
  { code: '10975', name: 'Phường Minh Khai', province_code: '31' },
  { code: '10978', name: 'Phường Phan Bội Châu', province_code: '31' },
  { code: '10981', name: 'Phường Quán Toan', province_code: '31' },

  // Cần Thơ
  { code: '31147', name: 'Phường Cái Khế', province_code: '92' },
  { code: '31150', name: 'Phường An Hòa', province_code: '92' },
  { code: '31153', name: 'Phường Thới Bình', province_code: '92' },
  { code: '31156', name: 'Phường An Nghiệp', province_code: '92' },
  { code: '31159', name: 'Phường An Cư', province_code: '92' },
  { code: '31162', name: 'Phường Tân An', province_code: '92' },
];

export const getProvinces = () => PROVINCES;

export const getWardsByProvince = (provinceCode) => {
  if (!provinceCode) return WARDS;
  return WARDS.filter((w) => w.province_code === String(provinceCode));
};

export const findProvinceByCode = (code) => PROVINCES.find((p) => p.code === String(code));
export const findWardByCode = (code) => WARDS.find((w) => w.code === String(code));
