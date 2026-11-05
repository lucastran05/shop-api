import inventoryRepository from '../modules/storefront/inventory.repository.js';
import { BadRequestError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class InventoryController {
  // GET /admin/inventory (INV01)
  static getInventory = asyncHandler(async (req, res) => {
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
  });

  // POST /admin/inventory/adjustments (INV02)
  static adjust = asyncHandler(async (req, res) => {
    const { product_id, variant_id, delta, reason } = req.body;

    if (!product_id || delta === undefined) {
      throw new BadRequestError('Vui lòng cung cấp product_id và delta');
    }

    const adjustment = await inventoryRepository.adjustInventory({
      product_id,
      variant_id,
      delta,
      reason,
      actor_id: req.user?.id || null,
      idempotency_key: req.get('Idempotency-Key'),
    });

    return res.status(200).json({
      status: 'success',
      message: 'Điều chỉnh tồn kho thành công',
      data: adjustment,
    });
  });

  // GET /admin/inventory/adjustments (INV03)
  static getAdjustments = asyncHandler(async (req, res) => {
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
  });
}

export default InventoryController;
