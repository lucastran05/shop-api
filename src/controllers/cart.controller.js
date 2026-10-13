import cartRepository from '../modules/storefront/cart.repository.js';

class CartController {
  // GET /api/v1/cart (CART01)
  static async getCart(req, res, next) {
    try {
      const cart = await cartRepository.getCart(req.user.id);
      return res.status(200).json({
        status: 'success',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/cart/items (CART02)
  static async addItem(req, res, next) {
    try {
      const { product_id, variant_id, quantity } = req.body;

      if (!product_id) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp product_id',
        });
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
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/cart/items/:item_id (CART03)
  static async updateItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp số lượng mới (quantity)',
        });
      }

      const cart = await cartRepository.updateItemQuantity(req.user.id, item_id, quantity);

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật giỏ hàng thành công',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/cart/items/:item_id (CART04)
  static async removeItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const cart = await cartRepository.removeItem(req.user.id, item_id);

      return res.status(200).json({
        status: 'success',
        message: 'Đã xóa sản phẩm khỏi giỏ hàng',
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default CartController;
