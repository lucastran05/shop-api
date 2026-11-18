// Bó hoa tự tạo: khách chọn hoa bán theo cành (products.sold_by_stem) và số cành từng loại.
// Các hàm ở đây là hàm thuần (không gọi DB) để dùng chung cho giỏ hàng, báo giá, tạo đơn và test.
import { createHash } from 'node:crypto';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { findVariant, variantStock } from '../catalog/productStock.js';
import {
  describeBouquetStyle,
  normalizeBouquetStyle,
  normalizeStemLength,
  wrapPrice,
} from './bouquetStyle.js';

export const CUSTOM_BOUQUET = 'custom_bouquet';
export const BOUQUET_NAME = 'Bó hoa tự chọn';
export const MAX_BOUQUET_STEMS = 200;
export const MAX_BOUQUET_QUANTITY = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER_IMAGE = '/product-placeholder.svg';

export const isCustomBouquet = (item) => item?.item_type === CUSTOM_BOUQUET;

const isPositiveInteger = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

// Kiểm tra request và chuẩn hóa thành phần: chỉ giữ product_id, variant_id, stems và stem_length
// (bỏ mọi trường giá), gộp dòng trùng biến thể và sắp xếp để cùng một bó luôn có cùng thứ tự.
// Mỗi loại hoa có chiều dài cành riêng; gửi trùng biến thể với hai chiều dài thì lấy chiều dài đầu tiên.
export function normalizeBouquetItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('Bó hoa phải có ít nhất một cành');
  }
  const merged = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object') throw new BadRequestError('Thành phần bó hoa không hợp lệ');
    const productId = typeof item.product_id === 'string' ? item.product_id.trim().toLowerCase() : '';
    if (!UUID_RE.test(productId)) throw new BadRequestError('product_id không hợp lệ');
    const variantId = ['string', 'number'].includes(typeof item.variant_id) ? String(item.variant_id).trim() : '';
    if (!variantId || variantId.length > 100) throw new BadRequestError('variant_id không hợp lệ');
    if (!isPositiveInteger(item.stems)) throw new BadRequestError('Số cành phải là số nguyên dương');
    const key = `${productId}|${variantId}`;
    const previous = merged.get(key);
    merged.set(key, {
      product_id: productId,
      variant_id: variantId,
      stems: (previous?.stems || 0) + item.stems,
      stem_length: previous?.stem_length ?? normalizeStemLength(item.stem_length),
    });
  }
  const components = [...merged.values()].sort((a, b) =>
    a.product_id.localeCompare(b.product_id) || a.variant_id.localeCompare(b.variant_id));
  const totalStems = components.reduce((sum, component) => sum + component.stems, 0);
  if (totalStems < 1) throw new BadRequestError('Bó hoa phải có ít nhất một cành');
  if (totalStems > MAX_BOUQUET_STEMS) {
    throw new BadRequestError(`Một bó hoa tối đa ${MAX_BOUQUET_STEMS} cành`);
  }
  return components;
}

export function normalizeBouquetQuantity(quantity) {
  if (quantity === undefined || quantity === null) return 1;
  if (!isPositiveInteger(quantity) || quantity > MAX_BOUQUET_QUANTITY) {
    throw new BadRequestError(`Số lượng bó phải là số nguyên từ 1 đến ${MAX_BOUQUET_QUANTITY}`);
  }
  return quantity;
}

// Định danh dòng giỏ của bó: hash thành phần và kiểu gói đã chuẩn hóa.
// Giống hệt nhau => cùng variant_id => cộng số lượng; khác một chi tiết => dòng riêng.
export function bouquetKey(components, style) {
  const { wrap, height } = normalizeBouquetStyle(style);
  const canonical = [
    components.map(({ product_id, variant_id, stems, stem_length }) =>
      [product_id, String(variant_id), stems, stem_length]),
    wrap,
    height,
  ];
  return 'custom:' + createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 32);
}

const variantLabel = (variant) => variant?.label || variant?.name || '';

// Tính giá và khả năng đặt của một bó theo dữ liệu sản phẩm hiện tại trong DB.
// productsById: Map(product_id -> { id, name, active, sold_by_stem, stock, variants, image, allow_deposit, deposit_rate })
// Giá bó = Σ(số cành × giá cành hiện tại) + phụ phí giấy gói. Không dùng giá nào do client gửi.
export function priceBouquet(storedComponents, productsById, quantity = 1, style) {
  const components = [];
  let unitPrice = 0;
  let maxBouquets = Infinity;
  let allValid = storedComponents.length > 0;
  let allowDeposit = true;
  let depositRate = 0;

  for (const stored of storedComponents) {
    const stems = Number(stored.stems);
    const product = productsById.get(String(stored.product_id));
    const variant = product ? findVariant(product.variants, stored.variant_id) : null;
    const valid = Boolean(product && variant && product.active && product.sold_by_stem) && stems > 0;
    const price = variant ? Number(variant.price) || 0 : 0;
    const stock = variant ? variantStock(variant) : 0;
    if (!valid) allValid = false;
    maxBouquets = Math.min(maxBouquets, valid ? Math.floor(stock / stems) : 0);
    unitPrice += price * stems;
    allowDeposit &&= Boolean(product?.allow_deposit);
    depositRate = Math.max(depositRate, Number(product?.deposit_rate) || 0);
    components.push({
      product_id: String(stored.product_id),
      variant_id: String(stored.variant_id),
      product_name: product?.name || stored.product_name || 'Hoa không còn bán',
      variant_label: variantLabel(variant) || stored.variant_label || '',
      color: variant?.color ?? stored.color ?? '',
      stems,
      stem_length: normalizeStemLength(stored.stem_length),
      unit_price: price,
      line_total: price * stems,
      image_url: variant?.stem_image || variant?.image || product?.image || PLACEHOLDER_IMAGE,
      stem_image: variant?.stem_image || null,
      stock_quantity: stock,
      is_available: valid && stock >= stems * quantity,
    });
  }

  const stockQuantity = Number.isFinite(maxBouquets) ? maxBouquets : 0;
  const described = describeBouquetStyle(style);
  return {
    components,
    style: described,
    flowers_price: unitPrice,
    unit_price: unitPrice + wrapPrice(described.wrap),
    stock_quantity: stockQuantity,
    is_available: allValid && stockQuantity >= quantity,
    allow_deposit: allValid && allowDeposit,
    deposit_rate: depositRate,
  };
}

// Mô tả ngắn gọn của bó, dùng làm variant_label ở giỏ / báo giá / đơn hàng
export function bouquetSummary(components) {
  return components
    .map((component) => `${component.stems} ${[component.product_name, component.color].filter(Boolean).join(' ')}`)
    .join(' · ');
}

// Dòng giỏ / báo giá của một bó (cùng khung trường với dòng sản phẩm thường)
export function bouquetLine({ id, variant_id, quantity, components: storedComponents, style }, productsById) {
  const qty = Number(quantity);
  const priced = priceBouquet(storedComponents, productsById, qty, style);
  return {
    id,
    item_type: CUSTOM_BOUQUET,
    product_id: null,
    variant_id,
    product_name: BOUQUET_NAME,
    variant_label: bouquetSummary(priced.components),
    style: priced.style,
    color: '',
    image_url: priced.components.find((component) => component.stem_image)?.stem_image
      || priced.components[0]?.image_url || PLACEHOLDER_IMAGE,
    allow_deposit: priced.allow_deposit,
    deposit_rate: priced.deposit_rate,
    unit_price: priced.unit_price,
    quantity: qty,
    stock_quantity: priced.stock_quantity,
    line_total: priced.unit_price * qty,
    is_available: priced.is_available,
    components: priced.components,
  };
}

// Kiểm tra chặt khi thêm bó vào giỏ: báo lỗi cụ thể cho từng thành phần.
export function assertBouquetAddable(components, productsById, totalQuantity) {
  for (const component of components) {
    const product = productsById.get(component.product_id);
    if (!product) throw new NotFoundError('Không tìm thấy hoa trong bó');
    const variant = findVariant(product.variants, component.variant_id);
    if (!variant) throw new NotFoundError(`Không tìm thấy màu đã chọn của ${product.name}`);
    if (!product.sold_by_stem) throw new BadRequestError(`${product.name} không bán theo cành`);
    if (!product.active) throw new ConflictError(`${product.name} đã ngừng bán`);
    const needed = component.stems * totalQuantity;
    const stock = variantStock(variant);
    if (stock < needed) {
      const name = [product.name, variant.color].filter(Boolean).join(' ');
      throw new ConflictError(`${name} chỉ còn ${stock} cành, không đủ ${needed} cành cho bó hoa`);
    }
  }
}

// Đơn vị tồn kho cần trừ / hoàn cho một dòng hàng: sản phẩm thường là chính nó,
// bó hoa là từng biến thể cành (số cành × số bó).
export function stockUnits(item) {
  if (!isCustomBouquet(item)) {
    return [{
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: Number(item.quantity),
      product_name: item.product_name,
      strict_variant: false,
    }];
  }
  return (item.components || []).map((component) => ({
    product_id: component.product_id,
    variant_id: component.variant_id,
    quantity: Number(component.stems) * Number(item.quantity),
    product_name: [component.product_name, component.color].filter(Boolean).join(' '),
    strict_variant: true,
  }));
}

// Thứ tự khóa sản phẩm cố định để tránh deadlock giữa các giao dịch đồng thời
export const sortStockUnits = (units) => [...units]
  .filter((unit) => unit.product_id)
  .sort((a, b) => String(a.product_id).localeCompare(String(b.product_id))
    || String(a.variant_id).localeCompare(String(b.variant_id)));

// Tổng nhu cầu theo biến thể trên mọi dòng của báo giá (hai bó cùng dùng hồng đỏ được cộng lại)
export function assertStockDemand(items) {
  const demand = new Map();
  for (const item of items) {
    const stocks = isCustomBouquet(item)
      ? item.components.map((component) => component.stock_quantity)
      : [Number(item.stock_quantity)];
    stockUnits(item).forEach((unit, index) => {
      const key = `${unit.product_id}|${unit.variant_id}`;
      const entry = demand.get(key) || { needed: 0, stock: stocks[index], name: unit.product_name };
      entry.needed += unit.quantity;
      demand.set(key, entry);
    });
  }
  for (const { needed, stock, name } of demand.values()) {
    if (Number.isFinite(stock) && needed > stock) {
      throw new ConflictError(`${name} không còn đủ tồn kho cho các dòng đã chọn`);
    }
  }
}
