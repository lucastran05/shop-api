import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_BOUQUET,
  assertBouquetAddable,
  assertStockDemand,
  bouquetKey,
  bouquetLine,
  normalizeBouquetItems,
  normalizeBouquetQuantity,
  priceBouquet,
  sortStockUnits,
  stockUnits,
} from '../src/modules/storefront/customBouquet.js';
import { keepStemImageFields } from '../src/modules/catalog/stemFlowers.js';
import { clampHeadSize } from '../src/modules/catalog/catalog.repository.js';
import {
  BOUQUET_HEIGHTS,
  BOUQUET_WRAPS,
  describeBouquetStyle,
  normalizeBouquetStyle,
  normalizeStemLength,
} from '../src/modules/storefront/bouquetStyle.js';
import { hasTransparency, pickPhoto, stemConfig } from '../scripts/demo-data/stem-photos.js';
import { renderStemPng } from '../scripts/demo-data/stem-art.js';

const ROSE = '11111111-1111-4111-8111-111111111111';
const BABY = '22222222-2222-4222-8222-222222222222';
const BOUQUET = '33333333-3333-4333-8333-333333333333';

function catalog(overrides = {}) {
  const products = [
    {
      id: ROSE, name: 'Hoa hồng cành', active: true, sold_by_stem: true,
      variants: [{ id: 'do', color: 'Đỏ', price: 20000, stock_quantity: 10, stem_image: '/uploads/rose.png' }],
    },
    {
      id: BABY, name: 'Hoa baby cành', active: true, sold_by_stem: true,
      variants: [{ id: 'trang', color: 'Trắng', price: 10000, stock: 7 }],
    },
    {
      id: BOUQUET, name: 'Bó hồng đỏ Ecuador', active: true, sold_by_stem: false,
      variants: [{ id: 'hong-10', label: '10 bông', price: 450000, stock_quantity: 5 }],
    },
  ].map((product) => ({ ...product, ...(overrides[product.id] || {}) }));
  return new Map(products.map((product) => [product.id, product]));
}

const MAIN = [
  { product_id: ROSE, variant_id: 'do', stems: 3 },
  { product_id: BABY, variant_id: 'trang', stems: 2 },
];

test('bó rỗng hoặc không phải mảng bị từ chối', () => {
  for (const items of [undefined, null, [], {}, 'abc']) {
    assert.throws(() => normalizeBouquetItems(items), { statusCode: 400 });
  }
});

test('stems phải là số nguyên dương kiểu number', () => {
  for (const stems of [0, -1, 1.5, '3', null, undefined, NaN, Infinity, true]) {
    assert.throws(
      () => normalizeBouquetItems([{ product_id: ROSE, variant_id: 'do', stems }]),
      { statusCode: 400 },
      `stems=${String(stems)}`,
    );
  }
});

test('product_id / variant_id sai định dạng bị từ chối', () => {
  assert.throws(() => normalizeBouquetItems([{ product_id: 'abc', variant_id: 'do', stems: 1 }]), { statusCode: 400 });
  assert.throws(() => normalizeBouquetItems([{ product_id: ROSE, variant_id: '', stems: 1 }]), { statusCode: 400 });
  assert.throws(() => normalizeBouquetItems([{ product_id: ROSE, stems: 1 }]), { statusCode: 400 });
});

test('chuẩn hóa: bỏ trường giá, gộp dòng trùng và sắp xếp ổn định', () => {
  const components = normalizeBouquetItems([
    { product_id: BABY, variant_id: 'trang', stems: 2, price: 1, unit_price: 1 },
    { product_id: ROSE.toUpperCase(), variant_id: 'do', stems: 1, line_total: 0 },
    { product_id: ROSE, variant_id: 'do', stems: 2 },
  ]);
  assert.deepEqual(
    components,
    MAIN.map((item) => ({ ...item, stem_length: 50 })),
  );
});

test('giới hạn tổng số cành và số bó', () => {
  assert.throws(() => normalizeBouquetItems([{ product_id: ROSE, variant_id: 'do', stems: 201 }]), { statusCode: 400 });
  assert.equal(normalizeBouquetQuantity(undefined), 1);
  assert.equal(normalizeBouquetQuantity(2), 2);
  for (const quantity of [0, -1, 1.5, '2', 51]) {
    assert.throws(() => normalizeBouquetQuantity(quantity), { statusCode: 400 });
  }
});

test('kiểu gói: mặc định, hợp lệ và không hợp lệ', () => {
  const base = { wrap: 'kraft', height: 'medium' };
  assert.deepEqual(normalizeBouquetStyle(), base);
  assert.deepEqual(normalizeBouquetStyle({ wrap: '', height: null }), base);
  assert.deepEqual(normalizeBouquetStyle({ wrap: 'silk', height: 'tall' }), { wrap: 'silk', height: 'tall' });
  for (const style of [{ wrap: 'vang' }, { height: 'rat-cao' }, { wrap: 1 }]) {
    assert.throws(() => normalizeBouquetStyle(style), { statusCode: 400 }, JSON.stringify(style));
  }
  assert.ok(BOUQUET_WRAPS.every((wrap) => wrap.id && wrap.name && Number.isFinite(wrap.price) && wrap.price >= 0));
  assert.ok(BOUQUET_HEIGHTS.every((height) => height.id && height.name));
  assert.deepEqual(describeBouquetStyle({ wrap: 'silk', height: 'low' }), {
    wrap: 'silk',
    wrap_name: 'Lụa Hàn Quốc',
    wrap_price: 30000,
    height: 'low',
    height_name: 'Thấp, xòe rộng',
  });
});

test('chiều dài cành: mặc định 50 cm, chỉ nhận bội số 5 trong 40-70', () => {
  assert.equal(normalizeStemLength(undefined), 50);
  for (const length of [40, 45, 55, 70]) assert.equal(normalizeStemLength(length), length);
  for (const length of [35, 75, 52, 'dai', 50.5, NaN]) {
    assert.throws(() => normalizeStemLength(length), { statusCode: 400 }, String(length));
  }
  assert.throws(
    () => normalizeBouquetItems([{ ...MAIN[0], stem_length: 52 }]),
    { statusCode: 400 },
    'chiều dài sai của một loại hoa làm hỏng cả request',
  );
});

test('mỗi loại hoa một chiều dài cành riêng', () => {
  const mixed = normalizeBouquetItems([
    { product_id: ROSE, variant_id: 'do', stems: 3, stem_length: 65 },
    { product_id: BABY, variant_id: 'trang', stems: 2, stem_length: 40 },
  ]);
  assert.deepEqual(mixed.map((c) => c.stem_length), [65, 40]);
  // Thiếu thì về 50 cm
  assert.equal(normalizeBouquetItems([MAIN[0]])[0].stem_length, 50);
  // Khác chiều dài là dòng giỏ riêng, nhưng giá không đổi
  const plain = normalizeBouquetItems(MAIN);
  assert.notEqual(bouquetKey(plain), bouquetKey(mixed));
  assert.equal(priceBouquet(mixed, catalog()).unit_price, priceBouquet(plain, catalog()).unit_price);
  // Chiều dài theo đến tận dòng giỏ để cửa hàng cắt đúng
  const line = bouquetLine({ id: 'l', variant_id: 'custom:x', quantity: 1, components: mixed }, catalog());
  assert.deepEqual(line.components.map((c) => [c.product_name, c.stem_length]), [
    ['Hoa hồng cành', 65],
    ['Hoa baby cành', 40],
  ]);
});

test('giấy gói cộng phụ phí vào giá bó, giấy kraft không mất phí', () => {
  const products = catalog();
  assert.equal(priceBouquet(MAIN, products).unit_price, 80000);
  const silk = priceBouquet(MAIN, products, 1, { wrap: 'silk', height: 'tall' });
  assert.equal(silk.flowers_price, 80000);
  assert.equal(silk.unit_price, 110000);
  assert.equal(silk.style.wrap_name, 'Lụa Hàn Quốc');
  const line = bouquetLine(
    { id: 'l1', variant_id: 'custom:x', quantity: 2, components: MAIN, style: { wrap: 'mesh' } },
    products,
  );
  assert.equal(line.unit_price, 100000);
  assert.equal(line.line_total, 200000);
  assert.equal(line.style.height, 'medium');
});

test('cùng thành phần cùng khóa, khác thành phần khác khóa', () => {
  const a = bouquetKey(normalizeBouquetItems([...MAIN].reverse()));
  const b = bouquetKey(normalizeBouquetItems(MAIN));
  const c = bouquetKey(normalizeBouquetItems([{ ...MAIN[0], stems: 4 }, MAIN[1]]));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^custom:[0-9a-f]{32}$/);
  assert.ok(a.length <= 100, 'vừa cột cart_items.variant_id');
  // Khác kiểu gói hoặc dáng bó cũng là dòng giỏ riêng
  const components = normalizeBouquetItems(MAIN);
  assert.notEqual(bouquetKey(components), bouquetKey(components, { wrap: 'silk' }));
  assert.notEqual(bouquetKey(components), bouquetKey(components, { height: 'tall' }));
  assert.equal(bouquetKey(components), bouquetKey(components, { wrap: 'kraft', height: 'medium' }));
});

test('giá bó = Σ số cành × giá cành trong DB (3 hồng 20.000 + 2 baby 10.000 = 80.000)', () => {
  const priced = priceBouquet(MAIN, catalog());
  assert.equal(priced.unit_price, 80000);
  assert.equal(priced.is_available, true);
  // Tồn: hồng 10/3 = 3 bó, baby 7/2 = 3 bó
  assert.equal(priced.stock_quantity, 3);
  assert.deepEqual(priced.components.map((c) => [c.product_name, c.color, c.stems, c.unit_price, c.line_total]), [
    ['Hoa hồng cành', 'Đỏ', 3, 20000, 60000],
    ['Hoa baby cành', 'Trắng', 2, 10000, 20000],
  ]);
  // Giá client gửi kèm trong thành phần đã lưu cũng không được dùng
  const tampered = priceBouquet(MAIN.map((c) => ({ ...c, unit_price: 1, price: 1 })), catalog());
  assert.equal(tampered.unit_price, 80000);
});

test('giá đổi trong DB thì giá bó trong giỏ đổi theo', () => {
  const products = catalog({ [ROSE]: { variants: [{ id: 'do', color: 'Đỏ', price: 25000, stock: 10 }] } });
  assert.equal(priceBouquet(MAIN, products).unit_price, 95000);
});

test('dòng giỏ của bó có đủ trường cho FE', () => {
  const line = bouquetLine({ id: 'line-1', variant_id: 'custom:x', quantity: 2, components: MAIN }, catalog());
  assert.equal(line.item_type, CUSTOM_BOUQUET);
  assert.equal(line.product_id, null);
  assert.equal(line.unit_price, 80000);
  assert.equal(line.line_total, 160000);
  assert.equal(line.image_url, '/uploads/rose.png');
  assert.equal(line.variant_label, '3 Hoa hồng cành Đỏ · 2 Hoa baby cành Trắng');
  assert.equal(line.is_available, true);
  assert.equal(line.components.length, 2);
});

test('hoa ngừng bán / bị xóa / quá tồn làm dòng bó không khả dụng', () => {
  assert.equal(priceBouquet(MAIN, catalog({ [ROSE]: { active: false } })).is_available, false);
  const missing = catalog();
  missing.delete(BABY);
  assert.equal(priceBouquet(MAIN, missing).is_available, false);
  assert.equal(priceBouquet(MAIN, catalog(), 4).is_available, false);
});

test('kiểm tra khi thêm vào giỏ trả đúng mã lỗi', () => {
  const products = catalog();
  assert.doesNotThrow(() => assertBouquetAddable(MAIN, products, 1));
  const unknown = [{ product_id: '44444444-4444-4444-8444-444444444444', variant_id: 'x', stems: 1 }];
  assert.throws(() => assertBouquetAddable(unknown, products, 1), { statusCode: 404 });
  assert.throws(() => assertBouquetAddable([{ product_id: ROSE, variant_id: 'tim', stems: 1 }], products, 1), { statusCode: 404 });
  assert.throws(() => assertBouquetAddable([{ product_id: BOUQUET, variant_id: 'hong-10', stems: 1 }], products, 1), { statusCode: 400 });
  assert.throws(() => assertBouquetAddable(MAIN, catalog({ [BABY]: { active: false } }), 1), { statusCode: 409 });
  // Tồn hồng đỏ là 10: 4 bó × 3 cành = 12 > 10
  assert.throws(() => assertBouquetAddable(MAIN, products, 4), { statusCode: 409, message: /chỉ còn 10 cành/ });
});

test('đơn vị kho: bó trừ từng cành theo số bó, sắp theo product_id', () => {
  const line = { item_type: CUSTOM_BOUQUET, quantity: 2, components: [
    { product_id: BABY, variant_id: 'trang', stems: 2, product_name: 'Hoa baby cành', color: 'Trắng' },
    { product_id: ROSE, variant_id: 'do', stems: 3, product_name: 'Hoa hồng cành', color: 'Đỏ' },
  ] };
  const regular = { product_id: BOUQUET, variant_id: 'hong-10', quantity: 1, product_name: 'Bó hồng' };
  const units = sortStockUnits([...stockUnits(line), ...stockUnits(regular)]);
  assert.deepEqual(units.map((u) => [u.product_id, u.variant_id, u.quantity, u.strict_variant]), [
    [ROSE, 'do', 6, true],
    [BABY, 'trang', 4, true],
    [BOUQUET, 'hong-10', 1, false],
  ]);
});

test('hai bó dùng chung một loại cành được cộng nhu cầu khi báo giá', () => {
  const products = catalog();
  const first = bouquetLine({ id: 'a', variant_id: 'custom:a', quantity: 2, components: MAIN }, products);
  const second = bouquetLine({ id: 'b', variant_id: 'custom:b', quantity: 1, components: [{ product_id: ROSE, variant_id: 'do', stems: 4 }] }, products);
  assert.equal(first.is_available && second.is_available, true);
  // 2 × 3 + 4 = 10 cành hồng: vừa đủ
  assert.doesNotThrow(() => assertStockDemand([first, second]));
  const third = bouquetLine({ id: 'c', variant_id: 'custom:c', quantity: 1, components: [{ product_id: ROSE, variant_id: 'do', stems: 1 }] }, products);
  assert.throws(() => assertStockDemand([first, second, third]), { statusCode: 409 });
});

test('form quản trị không làm mất ảnh cành khi sửa biến thể', () => {
  const previous = [{ id: 'do', price: 20000, stem_image: '/uploads/a.png', stem_photo: { photographer: 'A' } }];
  const next = keepStemImageFields([{ id: 'do', price: 21000 }, { id: 'moi', price: 1 }], previous);
  assert.deepEqual(next, [
    { id: 'do', price: 21000, stem_image: '/uploads/a.png', stem_photo: { photographer: 'A' } },
    { id: 'moi', price: 1 },
  ]);
  // Admin đổi ảnh biến thể: ảnh cành cũ bị bỏ, trang tự tạo bó dùng ảnh mới
  const changed = keepStemImageFields([{ id: 'do', image: '/uploads/moi.png' }], [{ ...previous[0], image: '/uploads/cu.png' }]);
  assert.deepEqual(changed, [{ id: 'do', image: '/uploads/moi.png' }]);
  const same = keepStemImageFields([{ id: 'do', image: '/uploads/cu.png' }], [{ ...previous[0], image: '/uploads/cu.png' }]);
  assert.equal(same[0].stem_image, '/uploads/a.png');
});

test('cỡ bông luôn nằm trong khoảng cho phép', () => {
  assert.equal(clampHeadSize(145), 145);
  assert.equal(clampHeadSize('70'), 70);
  assert.equal(clampHeadSize(99.6), 100);
  assert.equal(clampHeadSize(5), 30, 'quá nhỏ thì kéo về 30%');
  assert.equal(clampHeadSize(9999), 300, 'quá to thì kéo về 300%');
  for (const value of [undefined, null, '', 'abc', NaN, 0]) {
    assert.equal(clampHeadSize(value), 100, String(value));
  }
});

test('import:stems chọn ảnh đúng loại hoa, ưu tiên một cành', () => {
  const photos = [
    { id: 1, alt: 'Bouquet of red roses in a vase', width: 600, height: 900 },
    { id: 2, alt: 'Pink tulip field', width: 900, height: 600 },
    { id: 3, alt: 'Single red rose stem on white background', width: 600, height: 900 },
  ];
  assert.equal(pickPhoto(photos, { flower: 'rose', colorName: 'Đỏ' }).id, 3);
  assert.equal(pickPhoto([{ id: 4, alt: 'A cat' }], { flower: 'rose', colorName: 'Đỏ' }), null);
  assert.equal(stemConfig({ name: 'Hoa hồng cành' }, { id: 'hong-canh-do' }).query, 'single red rose stem');
  assert.equal(stemConfig({ name: 'Hoa tulip cành' }, { id: 'admin-1', color: 'Trắng' }).query, 'single white tulip stem');
});

test('ảnh dự phòng là PNG nền trong suốt và ổn định theo cấu hình', () => {
  const a = renderStemPng({ flower: 'rose', color: '#c81d3a', width: 60, height: 160 });
  const b = renderStemPng({ flower: 'rose', color: '#c81d3a', width: 60, height: 160 });
  assert.deepEqual(a.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(a.readUInt32BE(16), 60);
  assert.equal(a[25], 6, 'RGBA');
  assert.deepEqual(a, b);
  assert.equal(hasTransparency(a, 'image/png'), true);
  const rgb = Buffer.from(a);
  rgb[25] = 2;
  assert.equal(hasTransparency(rgb, 'image/png'), false);
  assert.equal(hasTransparency(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'), false);
});
