import catalogRepository from "../modules/catalog/catalog.repository.js";
import inventoryRepository from "../modules/storefront/inventory.repository.js";
import { removeStoredImage, storeImage } from "../services/upload-storage.js";
import { withTransaction } from "../config/transaction.js";
import pool from "../config/db.js";
import { getProductPricing } from "../modules/catalog/productPricing.js";
import { totalStock } from "../modules/catalog/productStock.js";
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class ProductController {
  // GET /api/v1/products/featured
  static getFeatured = asyncHandler(async (req, res) => {
    const result = await catalogRepository.findAllCustomer({
      is_pinned: true,
      page: Math.max(1, parseInt(req.query.page, 10) || 1),
      limit: 5,
    });
    return res.status(200).json({
      status: "success",
      data: result.items,
      filters: result.filters,
      pagination: result.pagination,
    });
  });

  // GET /api/v1/products (CAT01)
  static getAll = asyncHandler(async (req, res) => {
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
      flower_species: req.query.flower_species,
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
  });

  // GET /api/v1/products/:id (CAT02)
  static getById = asyncHandler(async (req, res) => {
    const id = req.params.product_id || req.params.id;
    const product = await catalogRepository.findDetailFormatted(id);

    if (!product) {
      throw new NotFoundError("Không tìm thấy sản phẩm");
    }

    return res.status(200).json({
      status: "success",
      data: product,
    });
  });

  // GET /api/v1/categories (CAT03)
  static getCategories = asyncHandler(async (req, res) => {
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
  });

  // --- Admin Endpoints (ADP01 - ADP07) ---

  static flowerSpecies = asyncHandler(async (_req, res) => {
    res.json({ status: 'success', data: await catalogRepository.listFlowerSpecies() });
  });

  // GET /admin/products (ADP01)
  static adminGetAll = asyncHandler(async (req, res) => {
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
  });

  // GET /admin/products/:id (ADP02)
  static adminGetById = asyncHandler(async (req, res) => {
    const id = req.params.product_id || req.params.id;
    const product = await catalogRepository.findDetailFormatted(id);

    if (!product) {
      throw new NotFoundError("Không tìm thấy sản phẩm");
    }

    return res.status(200).json({
      status: "success",
      data: product,
    });
  });

  // POST /admin/products & POST /api/v1/products (ADP03)
  static create = asyncHandler(async (req, res) => {
    const {
      name,
      category,
      category_id,
      description,
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
      throw new BadRequestError("Tên sản phẩm không được để trống");
    }

    // Có biến thể thì giá bán/giá gốc lấy theo biến thể rẻ nhất và tồn kho là tổng tồn các biến thể
    const hasVariants = Array.isArray(variants) && variants.length > 0;
    const pricing = hasVariants ? getProductPricing(variants) : { price, old_price: null };

    const created = await catalogRepository.create({
      name: name.trim(),
      category,
      category_id,
      description,
      image: image || images?.[0]?.url || "",
      images: images || [],
      variants: variants || [],
      attributes: attributes || [],
      flower_species: req.body.flower_species,
      is_active: is_active ?? active,
      is_pinned: is_pinned ?? featured,
      allow_deposit: allow_deposit ?? deposit,
      deposit_rate: deposit_rate || 20,
      price: pricing.price || 0,
      old_price: pricing.old_price,
      stock: (hasVariants ? totalStock(variants) : stock) || 0,
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
  });

  // PATCH /admin/products/:id & PUT /api/v1/products/:id (ADP04)
  static update = asyncHandler(async (req, res) => {
    const id = req.params.product_id || req.params.id;
    const existing = await catalogRepository.findById(id);

    if (!existing) {
      throw new NotFoundError("Không tìm thấy sản phẩm để cập nhật");
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
    if (req.body.flower_species !== undefined) updateFields.flower_species = req.body.flower_species;
    if (name !== undefined) updateFields.name = name;
    if (category !== undefined) updateFields.category = category;
    if (category_id !== undefined) updateFields.category_id = category_id;
    if (description !== undefined) updateFields.description = description;
    if (image !== undefined) updateFields.image = image;
    if (images !== undefined) updateFields.images = images;
    if (attributes !== undefined) updateFields.attributes = attributes;
    // Alias cũ (active/featured/deposit) chỉ dùng khi không gửi tên chuẩn
    updateFields.is_active = is_active ?? active;
    updateFields.is_pinned = is_pinned ?? featured;
    updateFields.allow_deposit = allow_deposit ?? deposit;
    if (deposit_rate !== undefined) updateFields.deposit_rate = deposit_rate;
    if (price !== undefined) updateFields.price = price;

    // Xử lý biến thể & kiểm tra tồn kho
    if (Array.isArray(variants)) {
      Object.assign(updateFields, getProductPricing(variants));
      updateFields.variants = variants;
      const totalVariantStock = totalStock(variants);
      updateFields.stock = totalVariantStock;
    } else if (stock !== undefined) {
      updateFields.stock = stock;
    }

    await catalogRepository.update(id, updateFields);

    // Ghi lịch sử tồn kho khi form chỉnh sửa làm thay đổi tổng tồn
    const stockBefore = Number(existing.stock) || 0;
    const stockAfter = Number(updateFields.stock ?? stockBefore);
    if (Number.isSafeInteger(stockAfter) && stockAfter !== stockBefore) {
      await inventoryRepository.recordAdjustment({
        product_id: id,
        variant_id: "bulk_edit",
        delta: stockAfter - stockBefore,
        stock_before: stockBefore,
        stock_after: stockAfter,
        reason: "Cập nhật từ form chỉnh sửa sản phẩm",
        actor_id: req.user?.id || null,
      });
    }
    const formatted = await catalogRepository.findDetailFormatted(id);

    return res.status(200).json({
      status: "success",
      message: "Cập nhật sản phẩm thành công",
      data: formatted,
    });
  });

  // DELETE /admin/products/:id & DELETE /api/v1/products/:id (ADP05)
  static delete = asyncHandler(async (req, res) => {
    const id = req.params.product_id || req.params.id;
    const existing = await catalogRepository.findById(id);

    if (!existing) {
      throw new NotFoundError("Không tìm thấy sản phẩm để xóa");
    }

    await catalogRepository.delete(id);

    return res.status(200).json({
      status: "success",
      message: "Xóa sản phẩm thành công",
      data: {
        deleted_id: id,
      },
    });
  });

  // POST /admin/products/bulk-delete (ADP06)
  static bulkDelete = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError("Vui lòng cung cấp danh sách ID sản phẩm cần xóa");
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
  });

  // POST /api/v1/uploads & POST /admin/uploads (REV03, ADP07)
  static upload = asyncHandler(async (req, res) => {
    const storedFiles = [];
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      const purpose = String(req.body?.purpose || "review");
      const allowedPurposes = new Set(["review", "product", "avatar"]);
      if (!allowedPurposes.has(purpose)) {
        throw new BadRequestError("Mục đích tải ảnh không hợp lệ");
      }
      if (
        purpose === "product" &&
        !["admin", "manager"].includes(req.user?.role)
      ) {
        throw new ForbiddenError("Chỉ quản trị viên hoặc quản lý được tải ảnh sản phẩm");
      }
      if (files.length < 1 || files.length > 3) {
        throw new BadRequestError("Vui lòng tải từ 1 đến 3 ảnh");
      }

      const maxSize = purpose === "review" ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
      const baseUrl = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
      const uploadList = [];
      await withTransaction(pool, async (client) => {
        for (const file of files) {
          if (file.size > maxSize) {
            throw new AppError(`Ảnh không được vượt quá ${purpose === "review" ? "2" : "10"} MB`, 413);
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
      // Lô upload lỗi: xóa các file đã ghi để không để lại file mồ côi
      await Promise.allSettled(storedFiles.map(removeStoredImage));
      throw error;
    }
  });
}

export default ProductController;
