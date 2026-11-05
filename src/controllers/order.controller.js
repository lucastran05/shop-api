import orderRepository from '../modules/storefront/order.repository.js';
import { BadRequestError, NotFoundError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class OrderController {
  // GET /api/v1/orders (ORD01)
  static getUserOrders = asyncHandler(async (req, res) => {
    const { status, page, limit } = req.query;
    const result = await orderRepository.getUserOrders(req.user.id, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return res.status(200).json({
      status: 'success',
      data: result.orders,
      pagination: result.pagination,
    });
  });

  // GET /api/v1/orders/:order_id (ORD02)
  static getUserOrderDetail = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const order = await orderRepository.getUserOrderDetail(req.user.id, order_id);

    if (!order) {
      throw new NotFoundError('Không tìm thấy đơn hàng');
    }

    return res.status(200).json({
      status: 'success',
      data: order,
    });
  });

  // POST /api/v1/orders/:order_id/cancel (ORD03)
  static cancelOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { reason } = req.body;

    const order = await orderRepository.cancelOrder(req.user.id, order_id, reason);

    return res.status(200).json({
      status: 'success',
      message: 'Hủy đơn hàng thành công',
      data: order,
    });
  });

  // --- Admin Orders (ADO01 - ADO03) ---

  // GET /admin/orders (ADO01)
  static getAdminOrders = asyncHandler(async (req, res) => {
    const { keyword, status, payment_status, view, page, limit } = req.query;
    const result = await orderRepository.getAdminOrders({
      keyword,
      status,
      payment_status,
      view,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return res.status(200).json({
      status: 'success',
      data: result.orders,
      pagination: result.pagination,
    });
  });

  // POST /admin/orders/bulk-delete
  static bulkDeleteAdminOrders = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('Vui lòng cung cấp danh sách ID đơn hàng cần xóa');
    }

    const result = await orderRepository.bulkDeleteAdminOrders(ids);
    return res.status(200).json({
      status: 'success',
      message: `Đã xử lý xóa ${result.deleted_ids.length} đơn hàng`,
      data: {
        deleted_ids: result.deleted_ids,
        failed: result.failed,
        deletedCount: result.deleted_ids.length,
      },
    });
  });
  // GET /admin/orders/:order_id (ADO02)
  static getAdminOrderDetail = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const order = await orderRepository.getAdminOrderDetail(order_id);

    if (!order) {
      throw new NotFoundError('Không tìm thấy đơn hàng');
    }

    return res.status(200).json({
      status: 'success',
      data: order,
    });
  });

  // PATCH /admin/orders/:order_id (ADO03)
  static updateAdminOrder = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { status, carrier, tracking_number, note, expected_updated_at } = req.body;

    const updated = await orderRepository.updateAdminOrder(
      order_id,
      { status, carrier, tracking_number, note, expected_updated_at },
      req.user?.name || 'Quản trị viên'
    );

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật trạng thái đơn hàng thành công',
      data: updated,
    });
  });
}

export default OrderController;
