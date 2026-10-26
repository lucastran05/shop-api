import catalogRepository from "../modules/catalog/catalog.repository.js";
import inventoryRepository from "../modules/storefront/inventory.repository.js";
import { removeStoredImage, storeImage } from "../services/upload-storage.js";
import { withTransaction } from "../config/transaction.js";
import pool from "../config/db.js";

class ProductController {
  // GET /api/v1/products (CAT01)
  static async getAll(req, res, next) {
    try {
      const {
        keyword,
        search,
        category_id,
        category,
        min_price,
        minPrice,
        max_price,
        maxPrice,
        in_stock,
        is_pinned,
        featured,
        sort,
        page,
        limit,
      } = req.query;

      const result = await catalogRepository.findAllCustomer({
        keyword: keyword || search || "",
        category_id: category_id || category || "",
        min_price: min_price !== undefined ? min_price : minPrice,
        max_price: max_price !== undefined ? max_price : maxPrice,
        in_stock,
        is_pinned: is_pinned !== undefined ? is_pinned : featured,
        sort: sort || "newest",
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return res.status(200).json({
        status: "success",
        data: result.items,
        filters: result.filters,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/products/:id (CAT02)
  static async getById(req, res, next) {
    try {
      const id = req.params.product_id || req.params.id;
      const product = await catalogRepository.findDetailFormatted(id);

      if (!product) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy sản phẩm",
        });
      }

      return res.status(200).json({
        status: "success",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/categories (CAT03)
  static async getCategories(req, res, next) {
    try {
      const categories = await catalogRepository.findAllCategories();
      const formatted = categories.map((c) => ({
        id: c.id,
        name: c.name,
        product_count: Number(c.product_count) || 0,
      }));

      return res.status(200).json({
        status: "success",
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- Admin Endpoints (ADP01 - ADP07) ---

  // GET /admin/products (ADP01)
  static async adminGetAll(req, res, next) {
    try {
      const { keyword, category_id, is_active, is_pinned, page, limit } =
        req.query;

      const result = await catalogRepository.findAdminProducts({
        keyword,
        category_id,
        is_active,
        is_pinned,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return res.status(200).json({
        status: "success",
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /admin/products/:id (ADP02)
  static async adminGetById(req, res, next) {
    try {
      const id = req.params.product_id || req.params.id;
      const product = await catalogRepository.findDetailFormatted(id);

      if (!product) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy sản phẩm",
        });
      }

      return res.status(200).json({
        status: "success",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/products & POST /api/v1/products (ADP03)
  static async create(req, res, next) {
    try {
      const {
        name,
        category,
        category_id,
        description,
        image_ids,
        image,
        images,
        is_active,
        active,
        is_pinned,
        featured,
        allow_deposit,
        deposit,
        deposit_rate,
        variants,
        attributes,
        price,
        stock,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Tên sản phẩm không được để trống",
        });
      }

      // Tự động tính toán giá và tổng tồn kho từ variants
      let finalPrice = price;
      let finalStock = stock;

      if (Array.isArray(variants) && variants.length > 0) {
        const variantPrices = variants.map((v) => Number(v.price) || 0);
        if (
          finalPrice === undefined ||
          finalPrice === null ||
          finalPrice === 0
        ) {
          finalPrice = Math.min(...variantPrices);
        }
        if (finalStock === undefined || finalStock === null) {
          finalStock = variants.reduce(
            (sum, v) => sum + (Number(v.stock_quantity || v.stock) || 0),
            0,
          );
        }
      }

      const created = await catalogRepository.create({
        name: name.trim(),
        category,
        category_id,
        description,
        image: image || (images && images[0]?.url) || "",
        images: images || [],
        variants: variants || [],
        attributes: attributes || [],
        is_active: is_active !== undefined ? is_active : active,
        is_pinned: is_pinned !== undefined ? is_pinned : featured,
        allow_deposit: allow_deposit !== undefined ? allow_deposit : deposit,
        deposit_rate: deposit_rate || 20,
        price: finalPrice || 0,
        stock: finalStock || 0,
      });

      const formatted = await catalogRepository.findDetailFormatted(created.id);

      return res.status(201).json({
        status: "success",
        message: "Tạo sản phẩm mới thành công",
        data: {
          ...formatted,
          product: formatted,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /admin/products/:id & PUT /api/v1/products/:id (ADP04)
  static async update(req, res, next) {
    try {
      const id = req.params.product_id || req.params.id;
      const existing = await catalogRepository.findById(id);

      if (!existing) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy sản phẩm để cập nhật",
        });
      }

      const {
        name,
        category,
        category_id,
        description,
        images,
        image,
        variants,
        attributes,
        is_active,
        active,
        is_pinned,
        featured,
        allow_deposit,
        deposit,
        deposit_rate,
        price,
        stock,
      } = req.body;

      const updateFields = {};
      if (name !== undefined) updateFields.name = name;
      if (category !== undefined) updateFields.category = category;
      if (category_id !== undefined) updateFields.category_id = category_id;
      if (description !== undefined) updateFields.description = description;
      if (image !== undefined) updateFields.image = image;
      if (images !== undefined) updateFields.images = images;
      if (attributes !== undefined) updateFields.attributes = attributes;
      if (is_active !== undefined) updateFields.is_active = is_active;
      if (active !== undefined) updateFields.active = active;
      if (is_pinned !== undefined) updateFields.is_pinned = is_pinned;
      if (featured !== undefined) updateFields.featured = featured;
      if (allow_deposit !== undefined)
        updateFields.allow_deposit = allow_deposit;
      if (deposit !== undefined) updateFields.deposit = deposit;
      if (deposit_rate !== undefined) updateFields.deposit_rate = deposit_rate;
      if (price !== undefined) updateFields.price = price;

      // Xử lý biến thể & kiểm tra tồn kho
      if (Array.isArray(variants)) {
        updateFields.variants = variants;
        const totalVariantStock = variants.reduce(
          (sum, v) => sum + (Number(v.stock_quantity || v.stock) || 0),
          0,
        );
        updateFields.stock = totalVariantStock;

        // Ghi lại lịch sử điều chỉnh nếu có thay đổi tồn
        if (Number(existing.stock) !== totalVariantStock) {
          try {
            await inventoryRepository.adjustInventory({
              product_id: id,
              variant_id: "bulk_edit",
              delta: totalVariantStock - Number(existing.stock),
              reason: "Cập nhật từ form chỉnh sửa sản phẩm",
              actor_id: req.user?.id || null,
            });
          } catch {}
        }
      } else if (stock !== undefined) {
        updateFields.stock = stock;
      }

      await catalogRepository.update(id, updateFields);
      const formatted = await catalogRepository.findDetailFormatted(id);

      return res.status(200).json({
        status: "success",
        message: "Cập nhật sản phẩm thành công",
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /admin/products/:id & DELETE /api/v1/products/:id (ADP05)
  static async delete(req, res, next) {
    try {
      const id = req.params.product_id || req.params.id;
      const existing = await catalogRepository.findById(id);

      if (!existing) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy sản phẩm để xóa",
        });
      }

      await catalogRepository.delete(id);

      return res.status(200).json({
        status: "success",
        message: "Xóa sản phẩm thành công",
        data: {
          deleted_id: id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/products/bulk-delete (ADP06)
  static async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Vui lòng cung cấp danh sách ID sản phẩm cần xóa",
        });
      }

      const result = await catalogRepository.bulkDelete(ids);

      return res.status(200).json({
        status: "success",
        message: `Đã xử lý xóa ${result.deleted_ids.length} sản phẩm`,
        data: {
          deleted_ids: result.deleted_ids,
          failed: result.failed,
          deletedCount: result.deleted_ids.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/uploads & POST /admin/uploads (REV03, ADP07)
  static async upload(req, res, next) {
    const storedFiles = [];
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      const purpose = String(req.body?.purpose || "review");
      const allowedPurposes = new Set(["review", "product", "avatar"]);
      if (!allowedPurposes.has(purpose)) {
        return res.status(400).json({
          status: "error",
          message: "Mục đích tải ảnh không hợp lệ",
        });
      }
      if (
        purpose === "product" &&
        !["admin", "manager"].includes(req.user?.role)
      ) {
        return res
          .status(403)
          .json({
            status: "error",
            message: "Chỉ quản trị viên hoặc quản lý được tải ảnh sản phẩm",
          });
      }
      if (files.length < 1 || files.length > 3) {
        return res.status(400).json({
          status: "error",
          message: "Vui lòng tải từ 1 đến 3 ảnh",
        });
      }

      const maxSize = purpose === "review" ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
      const baseUrl = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
      const uploadList = [];
      await withTransaction(pool, async (client) => {
        for (const file of files) {
          if (file.size > maxSize) {
            const error = new Error(
              `Ảnh không được vượt quá ${purpose === "review" ? "2" : "10"} MB`,
            );
            error.statusCode = 413;
            throw error;
          }
          const stored = await storeImage(file);
          storedFiles.push(stored.fileName);
          const originalName =
            String(file.originalname || stored.fileName)
              .split(/[\\/]/)
              .pop()
              .replace(/[^a-zA-Z0-9._ -]/g, "_")
              .slice(0, 255) || stored.fileName;
          const uploaded = await catalogRepository.createUpload(
            {
              url: `${baseUrl}/uploads/${stored.fileName}`,
              file_name: originalName,
              mime_type: file.mimetype,
              size_bytes: file.size,
              purpose,
            },
            client,
          );
          uploadList.push({
            id: uploaded.id,
            url: uploaded.url,
            file_name: uploaded.file_name,
            mime_type: uploaded.mime_type,
            size_bytes: Number(uploaded.size_bytes),
          });
        }
      });

      return res.status(201).json({
        status: "success",
        message: "Tải file thành công",
        data: uploadList,
      });
    } catch (error) {
      await Promise.allSettled(storedFiles.map(removeStoredImage));
      next(error);
    }
  }
}

export default ProductController;
