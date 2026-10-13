import orderRepository from '../modules/storefront/order.repository.js';

class CheckoutController {
  // POST /api/v1/checkout/quote (CHK01)
  static async getQuote(req, res, next) {
    try {
      const quote = await orderRepository.calculateQuote(req.user.id, req.body);
      return res.status(200).json({
        status: 'success',
        data: quote,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/orders (CHK02)
  static async createOrder(req, res, next) {
    try {
      const { quote_id, note } = req.body;
      const order = await orderRepository.createOrderFromQuote(req.user.id, {
        quote_id,
        note,
        quote_data: req.body,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Tạo đơn hàng thành công',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default CheckoutController;
