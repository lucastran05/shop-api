import catalogRepository from '../modules/catalog/catalog.repository.js';

class CategoryController {
  // GET /admin/categories (ADC01)
  static async getAll(req, res, next) {
    try {
      const categories = await catalogRepository.findAllCategories();
      return res.status(200).json({
        status: 'success',
        data: categories.map((c) => ({
          id: c.id,
          name: c.name,
          product_count: Number(c.product_count) || 0,
          created_at: c.created_at,
          updated_at: c.updated_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/categories (ADC02)
  static async create(req, res, next) {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Tên danh mục không được để trống',
        });
      }

      const existing = await catalogRepository.findCategoryByName(name);
      if (existing) {
        return res.status(400).json({
          status: 'error',
          message: 'Danh mục đã tồn tại',
        });
      }

      const created = await catalogRepository.createCategory(name);

      return res.status(201).json({
        status: 'success',
        message: 'Tạo danh mục thành công',
        data: {
          id: created.id,
          name: created.name,
          product_count: Number(created.product_count) || 0,
          created_at: created.created_at,
          updated_at: created.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /admin/categories/:category_id (ADC03)
  static async update(req, res, next) {
    try {
      const { category_id } = req.params;
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Tên danh mục không được để trống',
        });
      }

      const updated = await catalogRepository.updateCategory(category_id, name);
      if (!updated) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy danh mục để cập nhật',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật danh mục thành công',
        data: {
          id: updated.id,
          name: updated.name,
          product_count: Number(updated.product_count) || 0,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /admin/categories/:category_id (ADC04)
  static async delete(req, res, next) {
    try {
      const { category_id } = req.params;
      const deleted = await catalogRepository.deleteCategory(category_id);

      if (!deleted) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy danh mục để xóa',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Xóa danh mục thành công',
        data: {
          deleted_id: category_id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/categories/bulk-delete (ADC05)
  static async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp danh sách ID danh mục cần xóa',
        });
      }

      const result = await catalogRepository.bulkDeleteCategories(ids);

      return res.status(200).json({
        status: 'success',
        message: `Đã xử lý xóa ${result.deleted_ids.length} danh mục`,
        data: {
          deleted_ids: result.deleted_ids,
          failed: result.failed,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default CategoryController;
