import cartRepository from '../modules/storefront/cart.repository.js';
import { BOUQUET_HEIGHTS, BOUQUET_WRAPS, STEM_LENGTH } from '../modules/storefront/bouquetStyle.js';
import { BadRequestError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class CartController {
  // GET /api/v1/cart (CART01)
  static getCart = asyncHandler(async (req, res) => {
    const cart = await cartRepository.getCart(req.user.id);
    return res.status(200).json({
      status: 'success',
      data: cart,
    });
  });

  // POST /api/v1/cart/items (CART02)
  static addItem = asyncHandler(async (req, res) => {
    const { product_id, variant_id, quantity } = req.body;

    if (!product_id) {
      throw new BadRequestError('Vui lòng cung cấp product_id');
    }

    const cart = await cartRepository.addItem(req.user.id, {
      product_id,
      variant_id,
      quantity: quantity || 1,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Thêm sản phẩm vào giỏ hàng thành công',
      data: cart,
    });
  });

  // GET /api/v1/bouquets/options (CART06): kiểu giấy gói và dáng bó đang nhận
  static getBouquetOptions = asyncHandler(async (req, res) => {
    return res.status(200).json({
      status: 'success',
      data: { wraps: BOUQUET_WRAPS, heights: BOUQUET_HEIGHTS, stem_length: STEM_LENGTH },
    });
  });

  // POST /api/v1/cart/bouquets (CART05)
  // Chỉ đọc items[{product_id, variant_id, stems}], wrap, height và quantity;
  // mọi trường giá client gửi bị bỏ qua.
  static addBouquet = asyncHandler(async (req, res) => {
    const { items, quantity, wrap, height } = req.body || {};
    const cart = await cartRepository.addBouquet(req.user.id, { items, quantity, wrap, height });

    return res.status(200).json({
      status: 'success',
      message: 'Đã thêm bó hoa tự chọn vào giỏ hàng',
      data: cart,
    });
  });

  // PATCH /api/v1/cart/items/:item_id (CART03)
  static updateItem = asyncHandler(async (req, res) => {
    const { item_id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      throw new BadRequestError('Vui lòng cung cấp số lượng mới (quantity)');
    }

    const cart = await cartRepository.updateItemQuantity(req.user.id, item_id, quantity);

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật giỏ hàng thành công',
      data: cart,
    });
  });

  // DELETE /api/v1/cart/items/:item_id (CART04)
  static removeItem = asyncHandler(async (req, res) => {
    const { item_id } = req.params;
    const cart = await cartRepository.removeItem(req.user.id, item_id);

    return res.status(200).json({
      status: 'success',
      message: 'Đã xóa sản phẩm khỏi giỏ hàng',
      data: cart,
    });
  });
}

export default CartController;
