import orderRepository from '../modules/storefront/order.repository.js';

class OrderController {
  // GET /api/v1/orders (ORD01)
  static async getUserOrders(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/orders/:order_id (ORD02)
  static async getUserOrderDetail(req, res, next) {
    try {
      const { order_id } = req.params;
      const order = await orderRepository.getUserOrderDetail(req.user.id, order_id);

      if (!order) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy đơn hàng',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/orders/:order_id/cancel (ORD03)
  static async cancelOrder(req, res, next) {
    try {
      const { order_id } = req.params;
      const { reason } = req.body;

      const order = await orderRepository.cancelOrder(req.user.id, order_id, reason);

      return res.status(200).json({
        status: 'success',
        message: 'Hủy đơn hàng thành công',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- Admin Orders (ADO01 - ADO03) ---

  // GET /admin/orders (ADO01)
  static async getAdminOrders(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/orders/bulk-delete
  static async bulkDeleteAdminOrders(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp danh sách ID đơn hàng cần xóa',
        });
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
    } catch (error) {
      next(error);
    }
  }
  // GET /admin/orders/:order_id (ADO02)
  static async getAdminOrderDetail(req, res, next) {
    try {
      const { order_id } = req.params;
      const order = await orderRepository.getAdminOrderDetail(order_id);

      if (!order) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy đơn hàng',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /admin/orders/:order_id (ADO03)
  static async updateAdminOrder(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }
}

export default OrderController;
