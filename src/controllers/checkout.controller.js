import orderRepository from '../modules/storefront/order.repository.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class CheckoutController {
  // POST /api/v1/checkout/quote (CHK01)
  static getQuote = asyncHandler(async (req, res) => {
    const quote = await orderRepository.calculateQuote(req.user.id, req.body);
    return res.status(200).json({
      status: 'success',
      data: quote,
    });
  });

  // POST /api/v1/orders (CHK02)
  static createOrder = asyncHandler(async (req, res) => {
    const { quote_id, note } = req.body;
    const order = await orderRepository.createOrderFromQuote(req.user.id, {
      quote_id,
      note,
      quote_data: req.body,
      idempotency_key: req.get('Idempotency-Key'),
    });

    return res.status(201).json({
      status: 'success',
      message: 'Tạo đơn hàng thành công',
      data: order,
    });
  });
}

export default CheckoutController;
