import ProductModel from '../models/product.model.js';

class ProductService {
  // Lấy danh sách sản phẩm với các bộ lọc
  static async getAllProducts(filters) {
    return await ProductModel.findAll(filters);
  }

  // Lấy danh sách tất cả danh mục
  static async getCategories() {
    return await ProductModel.getCategories();
  }

  // Lấy chi tiết sản phẩm theo ID
  static async getProductById(id) {
    const product = await ProductModel.findById(id);
    if (!product) {
      const error = new Error('Không tìm thấy sản phẩm');
      error.statusCode = 404;
      throw error;
    }
    return product;
  }

  // Tạo sản phẩm mới
  static async createProduct(productData) {
    const { name, category, price, variants } = productData;

    if (!name || !name.trim()) {
      const error = new Error('Tên sản phẩm không được để trống');
      error.statusCode = 400;
      throw error;
    }

    if (!category || !category.trim()) {
      const error = new Error('Danh mục sản phẩm không được để trống');
      error.statusCode = 400;
      throw error;
    }

    // Tự động tính toán giá và số lượng nếu có mảng biến thể (variants)
    let finalPrice = price;
    let finalStock = productData.stock;

    if (Array.isArray(variants) && variants.length > 0) {
      const variantPrices = variants.map((v) => Number(v.price) || 0);
      if (finalPrice === undefined || finalPrice === null || finalPrice === 0) {
        finalPrice = Math.min(...variantPrices);
      }
      if (finalStock === undefined || finalStock === null) {
        finalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      }
    }

    const newProduct = await ProductModel.create({
      ...productData,
      name: name.trim(),
      category: category.trim(),
      price: finalPrice || 0,
      stock: finalStock !== undefined ? finalStock : 0,
    });

    return newProduct;
  }

  // Cập nhật sản phẩm
  static async updateProduct(id, updateData) {
    const existing = await ProductModel.findById(id);
    if (!existing) {
      const error = new Error('Không tìm thấy sản phẩm để cập nhật');
      error.statusCode = 404;
      throw error;
    }

    // Nếu cập nhật biến thể (variants), tự động cập nhật tồn kho nếu không truyền rõ ràng
    if (Array.isArray(updateData.variants) && updateData.variants.length > 0) {
      if (updateData.stock === undefined) {
        updateData.stock = updateData.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      }
    }

    const updated = await ProductModel.update(id, updateData);
    return updated;
  }

  // Xóa một sản phẩm
  static async deleteProduct(id) {
    const existing = await ProductModel.findById(id);
    if (!existing) {
      const error = new Error('Không tìm thấy sản phẩm để xóa');
      error.statusCode = 404;
      throw error;
    }

    return await ProductModel.delete(id);
  }

  // Xóa nhiều sản phẩm cùng lúc
  static async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      const error = new Error('Vui lòng cung cấp danh sách ID sản phẩm cần xóa');
      error.statusCode = 400;
      throw error;
    }

    const deletedCount = await ProductModel.deleteMany(ids);
    return { deletedCount };
  }
}

export default ProductService;
