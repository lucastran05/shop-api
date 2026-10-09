import ShopModel from '../models/shop.model.js';

class ShopService {
  // Lấy thông tin cửa hàng (tạo bản ghi mặc định nếu chưa tồn tại)
  static async getShopInfo() {
    let shop = await ShopModel.getShop();
    if (!shop) {
      shop = await ShopModel.create({});
    }
    return shop;
  }

  // Cập nhật thông tin cửa hàng
  static async updateShopInfo(updateData) {
    if (updateData.name !== undefined && !updateData.name.trim()) {
      const error = new Error('Tên cửa hàng không được để trống');
      error.statusCode = 400;
      throw error;
    }

    const updated = await ShopModel.update(updateData);
    return updated;
  }

  // Tạo hoặc ghi đè thông tin cửa hàng
  static async createShopInfo(data) {
    if (!data.name || !data.name.trim()) {
      const error = new Error('Tên cửa hàng không được để trống');
      error.statusCode = 400;
      throw error;
    }

    const created = await ShopModel.update(data);
    return created;
  }

  // Khôi phục cài đặt mặc định
  static async resetShopInfo() {
    return await ShopModel.resetToDefault();
  }
}

export default ShopService;
