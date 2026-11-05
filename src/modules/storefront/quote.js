// CHK01: báo giá đơn hàng. Báo giá được giữ trong bộ nhớ 15 phút để CHK02 tạo đơn theo đúng số tiền đã báo.
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { findProvinceByCode, findWardByCode } from '../../constants/locations.js';
import { findVariant, parseJsonArray, variantStock } from '../catalog/productStock.js';
import cartRepository from './cart.repository.js';
import { voucherRepository } from './voucher.repository.js';

const DELIVERY_METHODS = ['standard', 'express', 'pickup'];
const PAYMENT_METHODS = ['cod', 'bank_transfer', 'qr', 'vietqr', 'momo', 'card'];
const PAYMENT_MODES = ['deposit', 'full'];
const DEPOSIT_RATES = [50, 70];
const SHIPPING_FEE = 30000;
const FREE_SHIPPING_FROM = 500000;
const QUOTE_TTL_MS = 15 * 60 * 1000;

const quotes = new Map();

export function findQuote(quoteId) {
  return quotes.get(quoteId);
}

export function forgetQuote(quoteId) {
  quotes.delete(quoteId);
}

function rememberQuote(quote) {
  const now = new Date();
  for (const [id, cached] of quotes) if (new Date(cached.expires_at) <= now) quotes.delete(id);
  quotes.set(quote.quote_id, quote);
}

// Dòng hàng từ giỏ: chọn theo cart_item_ids, hoặc cả giỏ khi không chọn
async function loadCartItems(client, userId, cartItemIds) {
  const cart = await cartRepository.getCart(userId, client);
  if (!cartItemIds) {
    return { items: cart.items, cartItemIds: cart.items.map((item) => item.id) };
  }
  const uniqueIds = [...new Set(cartItemIds)];
  const items = cart.items.filter((item) => cartItemIds.includes(item.id));
  if (items.length !== uniqueIds.length) throw new BadRequestError('Dòng giỏ hàng không hợp lệ');
  return { items, cartItemIds: uniqueIds };
}

// Dòng hàng "mua ngay": đọc giá và tồn kho hiện tại của sản phẩm
async function loadDirectItems(client, requestedItems) {
  const items = [];
  for (const item of requestedItems) {
    const quantity = Number(item?.quantity);
    if (!item || typeof item !== 'object' || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new BadRequestError('Số lượng sản phẩm phải là số nguyên dương');
    }
    const { rows } = await client.query(
      'SELECT id, name, price, stock, variants, active, allow_deposit, deposit_rate FROM products WHERE id = $1;',
      [item.product_id],
    );
    const product = rows[0];
    if (!product) throw new NotFoundError('Không tìm thấy sản phẩm');

    const variants = parseJsonArray(product.variants);
    if (item.variant_id && variants.length && !findVariant(variants, item.variant_id)) {
      throw new BadRequestError('Biến thể sản phẩm không hợp lệ');
    }
    const variant = findVariant(variants, item.variant_id) || variants[0];
    const unitPrice = variant?.price !== undefined ? Number(variant.price) : Number(product.price);
    const stock = variantStock(variant, product.stock);

    items.push({
      product_id: product.id,
      variant_id: variant?.id ? String(variant.id) : (item.variant_id || 'default'),
      product_name: product.name,
      variant_label: variant?.label || variant?.name || 'Mặc định',
      color: variant?.color || '',
      image_url: variant?.image || '/product-placeholder.svg',
      allow_deposit: Boolean(product.allow_deposit),
      deposit_rate: Number(product.deposit_rate),
      unit_price: unitPrice,
      quantity,
      line_total: unitPrice * quantity,
      stock_quantity: stock,
      is_available: Boolean(product.active) && stock >= quantity,
    });
  }
  return items;
}

function assertItemsOrderable(items) {
  if (items.length === 0) throw new BadRequestError('Không có sản phẩm nào được chọn để báo giá');
  for (const item of items) {
    const quantity = Number(item.quantity);
    const price = Number(item.unit_price);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
      throw new BadRequestError('Sản phẩm hoặc số lượng không hợp lệ');
    }
    if (!item.is_available) throw new ConflictError('Sản phẩm không còn đủ tồn kho hoặc đã ngừng bán');
  }
}

const recipientFromAddress = (address) => ({
  name: address.recipient_name,
  phone: address.recipient_phone,
  full_address: address.full_address || `${address.street_address}, ${address.ward_name}, ${address.province_name}`,
});

// Người nhận: theo address_id, theo recipient gửi kèm, hoặc địa chỉ mặc định của khách
async function resolveRecipient(client, userId, addressId, recipient) {
  const addressColumns = 'recipient_name, recipient_phone, full_address, street_address, province_name, ward_name';
  if (addressId) {
    const { rows } = await client.query(
      `SELECT ${addressColumns} FROM user_addresses WHERE id = $1 AND user_id = $2;`,
      [addressId, userId],
    );
    if (!rows[0]) throw new BadRequestError('Địa chỉ nhận hàng không hợp lệ');
    return recipientFromAddress(rows[0]);
  }
  if (recipient) {
    const province = findProvinceByCode(recipient.province_code);
    const ward = findWardByCode(recipient.ward_code);
    return {
      name: recipient.name || '',
      phone: recipient.phone || '',
      full_address: recipient.full_address || `${recipient.street_address || ''}, ${ward?.name || ''}, ${province?.name || ''}`,
    };
  }
  const { rows } = await client.query(
    `SELECT ${addressColumns} FROM user_addresses WHERE user_id = $1 AND is_default = TRUE LIMIT 1;`,
    [userId],
  );
  return rows[0] ? recipientFromAddress(rows[0]) : { name: '', phone: '', full_address: '' };
}

// Nhận tại cửa hàng hoặc đơn từ 500.000đ được miễn phí giao hàng
const shippingFeeFor = (deliveryMethod, subtotal) =>
  deliveryMethod === 'pickup' || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

export async function calculateQuote(client, userId, {
  cart_item_ids,
  items: directItems,
  address_id,
  recipient: directRecipient,
  delivery_method = 'standard',
  coupon_code,
  payment_method = 'cod',
  payment_mode = 'full',
  deposit_rate: requestedDepositRate,
  note = '',
} = {}) {
  if (!DELIVERY_METHODS.includes(delivery_method) ||
      !PAYMENT_METHODS.includes(payment_method) ||
      !PAYMENT_MODES.includes(payment_mode)) {
    throw new BadRequestError('Lựa chọn giao hàng hoặc thanh toán không hợp lệ');
  }

  let items;
  let removedCartItemIds = [];
  if (Array.isArray(cart_item_ids) && cart_item_ids.length > 0) {
    ({ items, cartItemIds: removedCartItemIds } = await loadCartItems(client, userId, cart_item_ids));
  } else if (Array.isArray(directItems) && directItems.length > 0) {
    items = await loadDirectItems(client, directItems);
  } else {
    ({ items, cartItemIds: removedCartItemIds } = await loadCartItems(client, userId));
  }
  assertItemsOrderable(items);

  const recipient = await resolveRecipient(client, userId, address_id, directRecipient);
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const shippingFee = shippingFeeFor(delivery_method, subtotal);

  const coupon = coupon_code
    ? await voucherRepository.calculateDiscount(coupon_code, { subtotal, shippingFee, userId }, client)
    : null;
  const discountAmount = coupon ? coupon.discount_amount : 0;
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

  // Chỉ cho đặt cọc khi mọi sản phẩm đều hỗ trợ và mức cọc không thấp hơn yêu cầu của sản phẩm
  const allowedDepositRates = DEPOSIT_RATES.filter((rate) =>
    items.every((item) => item.allow_deposit && rate >= item.deposit_rate));
  const depositRate = requestedDepositRate === undefined ? allowedDepositRates[0] : Number(requestedDepositRate);
  const isDeposit = payment_mode === 'deposit';
  if (isDeposit && (!allowedDepositRates.includes(depositRate) || payment_method === 'cod')) {
    throw new BadRequestError('Sản phẩm không hỗ trợ mức cọc hoặc phương thức thanh toán này');
  }
  const depositAmount = isDeposit ? Math.round((totalAmount * depositRate) / 100) : 0;
  const amountDueNow = payment_method === 'cod' ? 0 : isDeposit ? depositAmount : totalAmount;

  const quote = {
    quote_id: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    expires_at: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    items,
    recipient,
    delivery_method,
    coupon,
    allowed_payment_methods: PAYMENT_METHODS,
    allowed_deposit_rates: allowedDepositRates,
    subtotal,
    shipping_fee: shippingFee,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    deposit_rate: isDeposit ? depositRate : 0,
    deposit_amount: depositAmount,
    amount_due_now: amountDueNow,
    paid_amount: 0,
    refunded_amount: 0,
    held_amount: 0,
    remaining_amount: totalAmount,
    currency: 'VND',
    payment_method,
    payment_mode,
    note,
    removed_cart_item_ids: removedCartItemIds,
    user_id: userId,
  };
  rememberQuote(quote);
  return quote;
}
