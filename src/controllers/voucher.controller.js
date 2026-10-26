import { voucherRepository } from '../modules/storefront/voucher.repository.js';

class VoucherController {
  static async list(req, res, next) {
    try {
      const { keyword, active } = req.query;
      const vouchers = await voucherRepository.list({ keyword, active });
      return res.status(200).json({ status: 'success', data: vouchers });
    } catch (error) {
      next(error);
    }
  }

  static async available(req, res, next) {
    try {
      const vouchers = await voucherRepository.listAvailable({ subtotal: req.query.subtotal });
      return res.status(200).json({ status: 'success', data: vouchers });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const voucher = await voucherRepository.create(req.body, req.user.id);
      return res.status(201).json({ status: 'success', message: 'Tạo voucher thành công', data: voucher });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const voucher = await voucherRepository.update(req.params.voucher_id, req.body);
      if (!voucher) return res.status(404).json({ status: 'error', message: 'Không tìm thấy voucher' });
      return res.status(200).json({ status: 'success', message: 'Cập nhật voucher thành công', data: voucher });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const deleted = await voucherRepository.delete(req.params.voucher_id);
      if (!deleted) return res.status(404).json({ status: 'error', message: 'Không tìm thấy voucher' });
      return res.status(200).json({ status: 'success', message: 'Xóa voucher thành công', data: { deleted_id: deleted.id } });
    } catch (error) {
      next(error);
    }
  }

  static async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp danh sách voucher cần xóa' });
      }
      const result = await voucherRepository.bulkDelete(ids);
      return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async validate(req, res, next) {
    try {
      const { code, subtotal, shipping_fee } = req.body;
      const voucher = await voucherRepository.calculateDiscount(code, { subtotal, shippingFee: shipping_fee });
      return res.status(200).json({ status: 'success', data: voucher });
    } catch (error) {
      next(error);
    }
  }
}

export default VoucherController;
