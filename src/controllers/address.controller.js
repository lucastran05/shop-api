import identityRepository from '../modules/identity/identity.repository.js';
import {
  getProvinces,
  getWardsByProvince,
  findProvinceByCode,
  findWardByCode,
} from '../constants/locations.js';
import { BadRequestError, NotFoundError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

// Chỉ chấp nhận mã tỉnh/xã có thật và xã phải thuộc tỉnh đã chọn
function resolveLocation(provinceCode, wardCode) {
  const province = findProvinceByCode(provinceCode);
  const ward = findWardByCode(wardCode);
  if (!province || !ward || ward.province_code !== province.code) {
    throw new BadRequestError('Tỉnh/thành hoặc phường/xã không hợp lệ');
  }
  return { province_name: province.name, ward_name: ward.name };
}

class AddressController {
  // GET /api/v1/me/addresses (ADR01)
  static getAddresses = asyncHandler(async (req, res) => {
    const addresses = await identityRepository.getAddresses(req.user.id);
    return res.status(200).json({
      status: 'success',
      data: addresses,
    });
  });

  // POST /api/v1/me/addresses (ADR02)
  static createAddress = asyncHandler(async (req, res) => {
    const {
      recipient_name,
      recipient_phone,
      province_code,
      ward_code,
      street_address,
      is_default,
    } = req.body;

    if (!recipient_name || !recipient_phone || !province_code || !ward_code || !street_address) {
      throw new BadRequestError('Vui lòng điền đầy đủ tên, số điện thoại, tỉnh, xã và địa chỉ chi tiết');
    }

    const { province_name, ward_name } = resolveLocation(province_code, ward_code);

    const newAddress = await identityRepository.createAddress(req.user.id, {
      recipient_name,
      recipient_phone,
      province_code,
      province_name,
      ward_code,
      ward_name,
      street_address,
      full_address: `${street_address}, ${ward_name}, ${province_name}`,
      is_default: Boolean(is_default),
    });

    return res.status(201).json({
      status: 'success',
      message: 'Thêm địa chỉ thành công',
      data: newAddress,
    });
  });

  // PATCH /api/v1/me/addresses/:address_id (ADR03)
  static updateAddress = asyncHandler(async (req, res) => {
    const { address_id } = req.params;
    const {
      recipient_name,
      recipient_phone,
      province_code,
      ward_code,
      street_address,
      is_default,
    } = req.body;

    const updates = {};
    if (recipient_name) updates.recipient_name = recipient_name;
    if (recipient_phone) updates.recipient_phone = recipient_phone;
    if (street_address) updates.street_address = street_address;
    if (is_default !== undefined) updates.is_default = Boolean(is_default);

    // Kiểm tra lại cặp tỉnh/xã và tính lại full_address nếu có thay đổi thông tin địa chỉ
    if (street_address || province_code || ward_code) {
      const existing = await identityRepository.getAddressById(address_id, req.user.id);
      if (existing) {
        const nextProvinceCode = province_code || existing.province_code;
        const nextWardCode = ward_code || existing.ward_code;
        const { province_name, ward_name } = resolveLocation(nextProvinceCode, nextWardCode);
        Object.assign(updates, {
          province_code: nextProvinceCode,
          province_name,
          ward_code: nextWardCode,
          ward_name,
          full_address: `${street_address || existing.street_address}, ${ward_name}, ${province_name}`,
        });
      }
    }

    const updated = await identityRepository.updateAddress(address_id, req.user.id, updates);
    if (!updated) {
      throw new NotFoundError('Không tìm thấy địa chỉ để cập nhật');
    }

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật địa chỉ thành công',
      data: updated,
    });
  });

  // DELETE /api/v1/me/addresses/:address_id (ADR04)
  static deleteAddress = asyncHandler(async (req, res) => {
    const { address_id } = req.params;
    const result = await identityRepository.deleteAddress(address_id, req.user.id);

    if (!result) {
      throw new NotFoundError('Không tìm thấy địa chỉ để xóa');
    }

    return res.status(200).json({
      status: 'success',
      message: 'Xóa địa chỉ thành công',
      data: result,
    });
  });

  // PATCH /api/v1/me/addresses/:address_id/default (ADR05)
  static setDefaultAddress = asyncHandler(async (req, res) => {
    const { address_id } = req.params;
    const result = await identityRepository.setDefaultAddress(address_id, req.user.id);

    if (!result) {
      throw new NotFoundError('Không tìm thấy địa chỉ');
    }

    return res.status(200).json({
      status: 'success',
      message: 'Đặt địa chỉ mặc định thành công',
      data: result,
    });
  });

  // GET /api/v1/locations/provinces (ADR06)
  static getProvinces = asyncHandler(async (req, res) => {
    const provinces = getProvinces();
    return res.status(200).json({
      status: 'success',
      data: provinces,
    });
  });

  // GET /api/v1/locations/wards (ADR07)
  static getWards = asyncHandler(async (req, res) => {
    const { province_code } = req.query;
    const wards = getWardsByProvince(province_code);
    return res.status(200).json({
      status: 'success',
      data: wards,
    });
  });
}

export default AddressController;
