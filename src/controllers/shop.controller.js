import ShopService from '../services/shop.service.js';

class ShopController {
  // GET /api/v1/shop (SHOP01)
  static async get(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // GET /admin/settings/shop (SET01)
  static async getAdminSettings(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // PATCH /admin/settings/shop & PUT /api/v1/shop (SET02)
  static async update(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/shop
  static async create(req, res, next) {
    try {
      const shop = await ShopService.createShopInfo(req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Lưu thông tin cửa hàng thành công',
        data: { shop },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/shop/reset
  static async reset(req, res, next) {
    try {
      const shop = await ShopService.resetShopInfo();

      return res.status(200).json({
        status: 'success',
        message: 'Khôi phục thông tin cửa hàng về mặc định thành công',
        data: { shop },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default ShopController;
