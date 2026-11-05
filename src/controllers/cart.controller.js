import cartRepository from '../modules/storefront/cart.repository.js';
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
