import ProductService from '../services/product.service.js';

class ProductController {
  // GET /api/v1/products
  static async getAll(req, res, next) {
    try {
      const {
        page,
        limit,
        search,
        category,
        featured,
        active,
        minPrice,
        maxPrice,
        sort,
      } = req.query;

      const result = await ProductService.getAllProducts({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        search,
        category,
        featured,
        active,
        minPrice,
        maxPrice,
        sort,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/products/categories
  static async getCategories(req, res, next) {
    try {
      const categories = await ProductService.getCategories();
      return res.status(200).json({
        status: 'success',
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/products/:id
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);

      return res.status(200).json({
        status: 'success',
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/products
  static async create(req, res, next) {
    try {
      const product = await ProductService.createProduct(req.body);

      return res.status(201).json({
        status: 'success',
        message: 'Tạo sản phẩm mới thành công',
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/products/:id
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const product = await ProductService.updateProduct(id, req.body);

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật sản phẩm thành công',
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/products/:id
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      await ProductService.deleteProduct(id);

      return res.status(200).json({
        status: 'success',
        message: 'Xóa sản phẩm thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/products/bulk-delete
  static async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const result = await ProductService.bulkDelete(ids);

      return res.status(200).json({
        status: 'success',
        message: `Đã xóa ${result.deletedCount} sản phẩm thành công`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default ProductController;
