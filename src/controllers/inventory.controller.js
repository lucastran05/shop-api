import inventoryRepository from '../modules/storefront/inventory.repository.js';

class InventoryController {
  // GET /admin/inventory (INV01)
  static async getInventory(req, res, next) {
    try {
      const { keyword, low_stock, sort, page, limit } = req.query;

      const result = await inventoryRepository.getInventory({
        keyword,
        low_stock,
        sort,
        page,
        limit,
      });

      return res.status(200).json({
        status: 'success',
        data: result.items,
        low_stock_threshold: result.low_stock_threshold,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/inventory/adjustments (INV02)
  static async adjust(req, res, next) {
    try {
      const { product_id, variant_id, delta, reason } = req.body;

      if (!product_id || delta === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp product_id và delta',
        });
      }

      const adjustment = await inventoryRepository.adjustInventory({
        product_id,
        variant_id,
        delta,
        reason,
        actor_id: req.user?.id || null,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Điều chỉnh tồn kho thành công',
        data: adjustment,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /admin/inventory/adjustments (INV03)
  static async getAdjustments(req, res, next) {
    try {
      const { product_id, variant_id, page, limit } = req.query;

      const result = await inventoryRepository.getAdjustments({
        product_id,
        variant_id,
        page,
        limit,
      });

      return res.status(200).json({
        status: 'success',
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default InventoryController;
