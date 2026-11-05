import { voucherRepository } from '../modules/storefront/voucher.repository.js';
import { BadRequestError, NotFoundError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class VoucherController {
  static list = asyncHandler(async (req, res) => {
    const { keyword, active } = req.query;
    const vouchers = await voucherRepository.list({ keyword, active });
    return res.status(200).json({ status: 'success', data: vouchers });
  });

  static available = asyncHandler(async (req, res) => {
    const vouchers = await voucherRepository.listAvailable({ subtotal: req.query.subtotal, userId: req.user.id });
    return res.status(200).json({ status: 'success', data: vouchers });
  });

  static create = asyncHandler(async (req, res) => {
    const voucher = await voucherRepository.create(req.body, req.user.id);
    return res.status(201).json({ status: 'success', message: 'Tạo voucher thành công', data: voucher });
  });

  static update = asyncHandler(async (req, res) => {
    const voucher = await voucherRepository.update(req.params.voucher_id, req.body);
    if (!voucher) throw new NotFoundError('Không tìm thấy voucher');
    return res.status(200).json({ status: 'success', message: 'Cập nhật voucher thành công', data: voucher });
  });

  static delete = asyncHandler(async (req, res) => {
    const deleted = await voucherRepository.delete(req.params.voucher_id);
    if (!deleted) throw new NotFoundError('Không tìm thấy voucher');
    return res.status(200).json({ status: 'success', message: 'Xóa voucher thành công', data: { deleted_id: deleted.id } });
  });

  static bulkDelete = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('Vui lòng cung cấp danh sách voucher cần xóa');
    }
    const result = await voucherRepository.bulkDelete(ids);
    return res.status(200).json({ status: 'success', data: result });
  });

  static validate = asyncHandler(async (req, res) => {
    const { code, subtotal, shipping_fee } = req.body;
    const voucher = await voucherRepository.calculateDiscount(code, { subtotal, shippingFee: shipping_fee, userId: req.user.id });
    return res.status(200).json({ status: 'success', data: voucher });
  });
}

export default VoucherController;
