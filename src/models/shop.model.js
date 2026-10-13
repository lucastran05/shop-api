import storefrontRepository from '../modules/storefront/storefront.repository.js';

class ShopModel {
  static async getShop() {
    return storefrontRepository.getShop();
  }

  static async create(data) {
    return storefrontRepository.create(data);
  }

  static async update(fields) {
    return storefrontRepository.update(fields);
  }

  static async resetToDefault() {
    return storefrontRepository.resetToDefault();
  }
}

export default ShopModel;
