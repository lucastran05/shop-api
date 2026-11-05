import ShopService from '../services/shop.service.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class ShopController {
  // GET /api/v1/shop (SHOP01)
  static get = asyncHandler(async (req, res) => {
    const shop = await ShopService.getShopInfo();

    return res.status(200).json({
      status: 'success',
      data: {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        business_mode: shop.business_mode || 'online_and_store',
        contact: shop.contact,
        updated_at: shop.updated_at || shop.updatedAt,
        shop,
      },
    });
  });

  // GET /admin/settings/shop (SET01)
  static getAdminSettings = asyncHandler(async (req, res) => {
    const shop = await ShopService.getShopInfo();

    return res.status(200).json({
      status: 'success',
      data: {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        business_mode: shop.business_mode || 'online_and_store',
        contact: shop.contact,
        updated_at: shop.updated_at || shop.updatedAt,
      },
    });
  });

  // PATCH /admin/settings/shop & PUT /api/v1/shop (SET02)
  static update = asyncHandler(async (req, res) => {
    const shop = await ShopService.updateShopInfo(req.body);

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật thông tin cửa hàng thành công',
      data: {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        business_mode: shop.business_mode || 'online_and_store',
        contact: shop.contact,
        updated_at: shop.updated_at || shop.updatedAt,
        shop,
      },
    });
  });

  // POST /api/v1/shop
  static create = asyncHandler(async (req, res) => {
    const shop = await ShopService.createShopInfo(req.body);

    return res.status(201).json({
      status: 'success',
      message: 'Lưu thông tin cửa hàng thành công',
      data: { shop },
    });
  });

  // POST /api/v1/shop/reset
  static reset = asyncHandler(async (req, res) => {
    const shop = await ShopService.resetShopInfo();

    return res.status(200).json({
      status: 'success',
      message: 'Khôi phục thông tin cửa hàng về mặc định thành công',
      data: { shop },
    });
  });
}

export default ShopController;
