import { BadRequestError } from '../../common/errors/AppError.js';

export function getProductPricing(variants) {
  let cheapest;
  for (const variant of variants) {
    const price = Number(variant.price);
    const oldPrice = variant.old_price == null || variant.old_price === '' ? null : Number(variant.old_price);
    if (!['number', 'string'].includes(typeof variant.price) || String(variant.price).trim() === '' || !Number.isFinite(price) || price < 0) throw new BadRequestError('Giá bán không hợp lệ');
    if (oldPrice !== null && (!['number', 'string'].includes(typeof variant.old_price) || !Number.isFinite(oldPrice) || oldPrice <= price)) {
      throw new BadRequestError('Giá gốc phải lớn hơn giá bán');
    }
    if (!cheapest || price < cheapest.price) cheapest = { price, old_price: oldPrice };
  }
  if (!cheapest) throw new BadRequestError('Sản phẩm phải có ít nhất một biến thể');
  return cheapest;
}
