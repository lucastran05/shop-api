// Danh mục và sản phẩm demo cho shop hoa / cây cảnh.
// Mỗi biến thể có ảnh minh họa SVG ở shop-web/public/products/<image>.svg
// (art: kiểu hình minh họa; colors: màu dùng để vẽ ảnh).

export const CATEGORIES = [
  'Hoa bó',
  'Giỏ & lẵng hoa',
  'Hoa cưới',
  'Lan hồ điệp',
  'Cây cảnh văn phòng',
  'Sen đá & xương rồng',
];

const careCutFlower = { name: 'care', label: 'Chăm sóc', value: 'Cắt chéo gốc, thay nước sạch mỗi ngày, tránh nắng gắt' };
const careOrchid = { name: 'care', label: 'Chăm sóc', value: 'Tưới phun sương 2 lần/tuần, để nơi thoáng có ánh sáng tán xạ' };
const carePlant = { name: 'care', label: 'Chăm sóc', value: 'Tưới khi đất khô mặt, ánh sáng gián tiếp, bón phân 1 lần/tháng' };
const careSucculent = { name: 'care', label: 'Chăm sóc', value: 'Tưới 1 lần/tuần, cần nhiều nắng, đất thoát nước tốt' };
const origin = (value) => ({ name: 'origin', label: 'Xuất xứ', value });
const size = (value) => ({ name: 'size', label: 'Kích thước', value });

export const PRODUCTS = [
  // --- Hoa bó
  {
    name: 'Bó hồng đỏ Ecuador',
    category: 'Hoa bó',
    pinned: true,
    description: 'Hoa hồng đỏ Ecuador bông to, cánh dày, gói giấy kraft kèm thiệp viết tay. Món quà kinh điển cho ngày kỷ niệm và Valentine.',
    attributes: [origin('Ecuador'), careCutFlower],
    art: 'bouquet', flower: 'rose',
    variants: [
      { id: 'hong-10', label: '10 bông', color: 'Đỏ', price: 450000, old_price: 520000, stock: 18, colors: ['#c81d3a', '#f3e3d3'] },
      { id: 'hong-20', label: '20 bông', color: 'Đỏ', price: 850000, stock: 10, colors: ['#c81d3a', '#f3e3d3'] },
      { id: 'hong-50', label: '50 bông', color: 'Đỏ', price: 1950000, stock: 4, colors: ['#c81d3a', '#2f2f2f'] },
    ],
  },
  {
    name: 'Bó hướng dương Nắng Mai',
    category: 'Hoa bó',
    pinned: true,
    description: 'Hướng dương tươi mới phối lá bạc và cỏ lau, mang năng lượng tích cực cho ngày khai giảng, tốt nghiệp hay chúc mừng.',
    attributes: [origin('Đà Lạt'), careCutFlower],
    art: 'bouquet', flower: 'sunflower',
    variants: [
      { id: 'hd-3', label: '3 bông', color: 'Vàng', price: 320000, stock: 25, colors: ['#f6b100', '#e9f1e4'] },
      { id: 'hd-5', label: '5 bông', color: 'Vàng', price: 480000, stock: 15, colors: ['#f6b100', '#e9f1e4'] },
      { id: 'hd-9', label: '9 bông', color: 'Vàng', price: 790000, old_price: 890000, stock: 8, colors: ['#f6b100', '#dfe8f3'] },
    ],
  },
  {
    name: 'Bó tulip Hà Lan',
    category: 'Hoa bó',
    description: 'Tulip nhập khẩu Hà Lan, 10 bông một bó, dáng thanh lịch. Hoa nở dần trong 5 - 7 ngày.',
    attributes: [origin('Hà Lan'), careCutFlower],
    art: 'bouquet', flower: 'tulip',
    variants: [
      { id: 'tulip-hong', label: '10 bông', color: 'Hồng', price: 690000, stock: 12, colors: ['#ee7fa8', '#f6eef1'] },
      { id: 'tulip-trang', label: '10 bông', color: 'Trắng', price: 690000, stock: 9, colors: ['#f5f2ea', '#dfe6ee'] },
      { id: 'tulip-vang', label: '10 bông', color: 'Vàng', price: 690000, stock: 7, colors: ['#f7c948', '#eef3e6'] },
    ],
  },
  {
    name: 'Bó baby trắng Tinh Khôi',
    category: 'Hoa bó',
    description: 'Hoa baby trắng li ti như những vì sao, gói giấy pastel. Phù hợp tặng bạn bè, chụp ảnh kỷ yếu.',
    attributes: [origin('Đà Lạt'), careCutFlower],
    art: 'bouquet', flower: 'baby',
    variants: [
      { id: 'baby-nho', label: 'Nhỏ', color: 'Trắng', price: 250000, stock: 30, colors: ['#ffffff', '#f2dbe3'] },
      { id: 'baby-lon', label: 'Lớn', color: 'Trắng', price: 420000, stock: 14, colors: ['#ffffff', '#d9e6f2'] },
    ],
  },
  {
    name: 'Bó cẩm tú cầu xanh Biển Lặng',
    category: 'Hoa bó',
    description: 'Cẩm tú cầu xanh ngọc mix hoa thạch thảo, tượng trưng cho sự chân thành và biết ơn.',
    attributes: [origin('Đà Lạt'), careCutFlower],
    art: 'bouquet', flower: 'hydrangea',
    variants: [
      { id: 'ctc', label: 'Tiêu chuẩn', color: 'Xanh dương', price: 550000, stock: 11, colors: ['#6f9fd8', '#f1ece2'] },
    ],
  },

  // --- Giỏ & lẵng hoa
  {
    name: 'Giỏ hoa hồng phấn Ngọt Ngào',
    category: 'Giỏ & lẵng hoa',
    description: 'Giỏ mây đan cắm hồng phấn, cẩm chướng và lá bạc. Đặt bàn làm việc hay tặng sinh nhật đều đẹp.',
    attributes: [size('Cao 35 - 45 cm'), careCutFlower],
    art: 'basket', flower: 'rose',
    variants: [
      { id: 'gio-hong-vua', label: 'Vừa', color: 'Hồng phấn', price: 650000, stock: 9, colors: ['#f19cb7', '#b98654'] },
      { id: 'gio-hong-lon', label: 'Lớn', color: 'Hồng phấn', price: 980000, old_price: 1100000, stock: 5, colors: ['#f19cb7', '#9c6b3f'] },
    ],
  },
  {
    name: 'Lẵng hoa khai trương Phát Tài',
    category: 'Giỏ & lẵng hoa',
    pinned: true,
    deposit: 30,
    description: 'Kệ hoa khai trương 2 tầng với hồng đỏ, đồng tiền vàng và lan vũ nữ, kèm băng rôn chúc mừng in theo yêu cầu. Giao và lắp đặt tận nơi.',
    attributes: [size('Cao 1,6 - 1,8 m'), { name: 'service', label: 'Dịch vụ', value: 'Miễn phí in băng rôn, giao lắp đặt nội thành' }],
    art: 'basket', flower: 'mix',
    variants: [
      { id: 'kt-2tang', label: 'Kệ 2 tầng', color: 'Đỏ vàng', price: 1800000, stock: 6, colors: ['#d62839', '#f6b100'] },
      { id: 'kt-3tang', label: 'Kệ 3 tầng', color: 'Đỏ vàng', price: 2500000, stock: 3, colors: ['#d62839', '#f6b100'] },
    ],
  },
  {
    name: 'Giỏ cẩm chướng Tri Ân',
    category: 'Giỏ & lẵng hoa',
    description: 'Cẩm chướng hồng đào cắm giỏ nhỏ xinh, món quà tri ân thầy cô, cha mẹ.',
    attributes: [size('Cao 30 cm'), careCutFlower],
    art: 'basket', flower: 'carnation',
    variants: [
      { id: 'cc', label: 'Tiêu chuẩn', color: 'Hồng đào', price: 520000, stock: 13, colors: ['#f08080', '#c49a6c'] },
    ],
  },

  // --- Hoa cưới
  {
    name: 'Hoa cầm tay cô dâu Pastel',
    category: 'Hoa cưới',
    deposit: 50,
    description: 'Hoa cầm tay dáng tròn với hồng juliet, cát tường và lá bạc. Đặt trước tối thiểu 3 ngày, đặt cọc 50%.',
    attributes: [size('Đường kính 25 cm'), { name: 'lead', label: 'Thời gian đặt', value: 'Đặt trước ít nhất 3 ngày' }],
    art: 'bridal', flower: 'rose',
    variants: [
      { id: 'cd-pastel', label: 'Tiêu chuẩn', color: 'Hồng pastel', price: 1200000, stock: 6, colors: ['#f6c1cc', '#ffffff'] },
      { id: 'cd-trang', label: 'Tiêu chuẩn', color: 'Trắng xanh', price: 1250000, stock: 6, colors: ['#f7f4ee', '#a8c7a0'] },
    ],
  },
  {
    name: 'Hoa cưới hồng trắng Cổ Điển',
    category: 'Hoa cưới',
    deposit: 50,
    description: 'Bó cưới hồng trắng Ecuador buộc ruy băng lụa, phong cách cổ điển sang trọng.',
    attributes: [size('Đường kính 22 cm'), { name: 'lead', label: 'Thời gian đặt', value: 'Đặt trước ít nhất 3 ngày' }],
    art: 'bridal', flower: 'rose',
    variants: [
      { id: 'cd-codien', label: 'Tiêu chuẩn', color: 'Trắng', price: 1500000, old_price: 1700000, stock: 4, colors: ['#fbf8f2', '#d9c6a5'] },
    ],
  },

  // --- Lan hồ điệp
  {
    name: 'Lan hồ điệp trắng',
    category: 'Lan hồ điệp',
    pinned: true,
    deposit: 30,
    description: 'Chậu lan hồ điệp trắng tinh khiết trồng chậu sứ, hoa bền 1,5 - 2 tháng. Thích hợp trưng bày sảnh, tặng đối tác.',
    attributes: [origin('Vườn lan Bảo Lộc'), careOrchid],
    art: 'orchid',
    variants: [
      { id: 'lan-trang-3', label: '3 cành', color: 'Trắng', price: 1650000, stock: 7, colors: ['#ffffff', '#f2f2ef'] },
      { id: 'lan-trang-5', label: '5 cành', color: 'Trắng', price: 2600000, stock: 4, colors: ['#ffffff', '#e8e1d5'] },
    ],
  },
  {
    name: 'Lan hồ điệp tím',
    category: 'Lan hồ điệp',
    description: 'Lan hồ điệp tím đậm sang trọng, 2 cành, chậu gốm men xanh.',
    attributes: [origin('Vườn lan Bảo Lộc'), careOrchid],
    art: 'orchid',
    variants: [
      { id: 'lan-tim-2', label: '2 cành', color: 'Tím', price: 1150000, stock: 8, colors: ['#9b4f96', '#3c6e8f'] },
    ],
  },
  {
    name: 'Lan hồ điệp vàng chậu sứ',
    category: 'Lan hồ điệp',
    description: 'Sắc vàng tượng trưng cho tài lộc, rất được ưa chuộng dịp Tết và khai trương.',
    attributes: [origin('Vườn lan Bảo Lộc'), careOrchid],
    art: 'orchid',
    variants: [
      { id: 'lan-vang-2', label: '2 cành', color: 'Vàng', price: 1350000, stock: 6, colors: ['#f4c430', '#ffffff'] },
      { id: 'lan-vang-3', label: '3 cành', color: 'Vàng', price: 1890000, stock: 3, colors: ['#f4c430', '#ffffff'] },
    ],
  },

  // --- Cây cảnh văn phòng
  {
    name: 'Cây kim tiền',
    category: 'Cây cảnh văn phòng',
    description: 'Cây kim tiền lá xanh bóng, dễ chăm, mang ý nghĩa tiền tài sung túc. Kèm chậu sứ trắng.',
    attributes: [carePlant, { name: 'light', label: 'Ánh sáng', value: 'Chịu bóng tốt, hợp phòng máy lạnh' }],
    art: 'plant', plant: 'zamioculcas',
    variants: [
      { id: 'kt-nho', label: 'Nhỏ (40 cm)', color: '', price: 220000, stock: 20, colors: ['#3f7d3a', '#f4f1ea'] },
      { id: 'kt-vua', label: 'Vừa (70 cm)', color: '', price: 380000, stock: 12, colors: ['#3f7d3a', '#f4f1ea'] },
      { id: 'kt-lon', label: 'Lớn (1 m)', color: '', price: 650000, stock: 5, colors: ['#3f7d3a', '#2f2f2f'] },
    ],
  },
  {
    name: 'Cây lưỡi hổ',
    category: 'Cây cảnh văn phòng',
    description: 'Lưỡi hổ viền vàng lọc không khí tốt, gần như không cần chăm, hợp người bận rộn.',
    attributes: [carePlant, { name: 'light', label: 'Ánh sáng', value: 'Chịu bóng, chịu hạn' }],
    art: 'plant', plant: 'snake',
    variants: [
      { id: 'lh-nho', label: 'Nhỏ (35 cm)', color: '', price: 180000, stock: 22, colors: ['#4c7a34', '#c8705a'] },
      { id: 'lh-vua', label: 'Vừa (60 cm)', color: '', price: 320000, stock: 10, colors: ['#4c7a34', '#c8705a'] },
    ],
  },
  {
    name: 'Cây trầu bà Nam Mỹ (Monstera)',
    category: 'Cây cảnh văn phòng',
    pinned: true,
    description: 'Monstera lá xẻ đặc trưng, điểm nhấn nhiệt đới cho phòng khách và quán cà phê.',
    attributes: [carePlant, { name: 'light', label: 'Ánh sáng', value: 'Ánh sáng gián tiếp, tránh nắng trực tiếp' }],
    art: 'plant', plant: 'monstera',
    variants: [
      { id: 'mons-vua', label: 'Vừa (60 cm)', color: '', price: 450000, stock: 9, colors: ['#2f6b3a', '#e9e4da'] },
      { id: 'mons-lon', label: 'Lớn (1,2 m)', color: '', price: 850000, old_price: 990000, stock: 4, colors: ['#2f6b3a', '#c8705a'] },
    ],
  },
  {
    name: 'Cây bàng Singapore',
    category: 'Cây cảnh văn phòng',
    deposit: 30,
    description: 'Bàng Singapore lá to hình đàn, dáng cây thẳng đẹp, rất hợp góc phòng sáng.',
    attributes: [carePlant, size('1 - 1,6 m')],
    art: 'plant', plant: 'fiddle',
    variants: [
      { id: 'bang-1m', label: '1 m', color: '', price: 520000, stock: 7, colors: ['#3b7a3f', '#efece6'] },
      { id: 'bang-16m', label: '1,6 m', color: '', price: 1200000, stock: 3, colors: ['#3b7a3f', '#2f2f2f'] },
    ],
  },
  {
    name: 'Cây phát tài núi',
    category: 'Cây cảnh văn phòng',
    description: 'Phát tài núi thân gỗ nhiều tầng lá, phong thủy tốt cho văn phòng và cửa hàng.',
    attributes: [carePlant, size('Cao 1,2 m')],
    art: 'plant', plant: 'dracaena',
    variants: [
      { id: 'ptn', label: 'Tiêu chuẩn', color: '', price: 950000, stock: 5, colors: ['#4d8a3c', '#c8705a'] },
    ],
  },

  // --- Sen đá & xương rồng
  {
    name: 'Sen đá kim cương',
    category: 'Sen đá & xương rồng',
    description: 'Sen đá kim cương lá dày ánh tím hồng, chậu sứ mini để bàn.',
    attributes: [careSucculent, size('Chậu 8 cm')],
    art: 'succulent',
    variants: [
      { id: 'sd-kc', label: 'Chậu 8 cm', color: '', price: 65000, stock: 45, colors: ['#b7a3c9', '#ffffff'] },
    ],
  },
  {
    name: 'Combo 6 sen đá mini',
    category: 'Sen đá & xương rồng',
    description: '6 chậu sen đá nhiều màu kèm khay gỗ, quà tặng xinh xắn cho bàn làm việc.',
    attributes: [careSucculent, { name: 'set', label: 'Bộ gồm', value: '6 chậu sen đá + 1 khay gỗ' }],
    art: 'succulent',
    variants: [
      { id: 'sd-combo', label: 'Combo 6 chậu', color: '', price: 290000, old_price: 350000, stock: 16, colors: ['#8fbf8a', '#d4a373'] },
    ],
  },
  {
    name: 'Xương rồng tai thỏ',
    category: 'Sen đá & xương rồng',
    description: 'Xương rồng tai thỏ đáng yêu, gai mềm, rất dễ sống.',
    attributes: [careSucculent, size('Chậu 7 cm')],
    art: 'cactus', plant: 'bunny',
    variants: [
      { id: 'xr-tt', label: 'Chậu 7 cm', color: '', price: 75000, stock: 38, colors: ['#7fae5b', '#f2e6d8'] },
    ],
  },
  {
    name: 'Xương rồng trứng chim có hoa',
    category: 'Sen đá & xương rồng',
    description: 'Xương rồng trứng chim nở hoa hồng tươi, quà tặng nhỏ mang may mắn.',
    attributes: [careSucculent, size('Chậu 8 cm')],
    art: 'cactus', plant: 'ball',
    variants: [
      { id: 'xr-hoa', label: 'Chậu 8 cm', color: 'Hoa hồng', price: 120000, stock: 24, colors: ['#5f9a4d', '#f472b6'] },
    ],
  },
];

// Ảnh của một biến thể: /products/<id>.svg
export const variantImage = (variant) => `/products/${variant.id}.svg`;
