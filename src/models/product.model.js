import catalogRepository from '../modules/catalog/catalog.repository.js';

class ProductModel {
  static async findAll(filters) {
    return catalogRepository.findAll(filters);
  }

  static async findById(id) {
    return catalogRepository.findById(id);
  }

  static async getCategories() {
    return catalogRepository.getCategories();
  }

  static async create(data) {
    return catalogRepository.create(data);
  }

  static async update(id, fields) {
    return catalogRepository.update(id, fields);
  }

  static async delete(id) {
    return catalogRepository.delete(id);
  }

  static async deleteMany(ids) {
    return catalogRepository.deleteMany(ids);
  }
}

export default ProductModel;
