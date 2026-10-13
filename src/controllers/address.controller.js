import identityRepository from '../modules/identity/identity.repository.js';
import {
  getProvinces,
  getWardsByProvince,
  findProvinceByCode,
  findWardByCode,
} from '../constants/locations.js';

class AddressController {
  // GET /api/v1/me/addresses (ADR01)
  static async getAddresses(req, res, next) {
    try {
      const addresses = await identityRepository.getAddresses(req.user.id);
      return res.status(200).json({
        status: 'success',
        data: addresses,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/me/addresses (ADR02)
  static async createAddress(req, res, next) {
    try {
      const {
        recipient_name,
        recipient_phone,
        province_code,
        ward_code,
        street_address,
        is_default,
      } = req.body;

      if (!recipient_name || !recipient_phone || !province_code || !ward_code || !street_address) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng điền đầy đủ tên, số điện thoại, tỉnh, xã và địa chỉ chi tiết',
        });
      }

      const province = findProvinceByCode(province_code);
      const ward = findWardByCode(ward_code);

      const provinceName = province ? province.name : province_code;
      const wardName = ward ? ward.name : ward_code;
      const fullAddress = `${street_address}, ${wardName}, ${provinceName}`;

      const newAddress = await identityRepository.createAddress(req.user.id, {
        recipient_name,
        recipient_phone,
        province_code,
        province_name: provinceName,
        ward_code,
        ward_name: wardName,
        street_address,
        full_address: fullAddress,
        is_default: Boolean(is_default),
      });

      return res.status(201).json({
        status: 'success',
        message: 'Thêm địa chỉ thành công',
        data: newAddress,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/me/addresses/:address_id (ADR03)
  static async updateAddress(req, res, next) {
    try {
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
      if (province_code) {
        updates.province_code = province_code;
        const prov = findProvinceByCode(province_code);
        if (prov) updates.province_name = prov.name;
      }
      if (ward_code) {
        updates.ward_code = ward_code;
        const w = findWardByCode(ward_code);
        if (w) updates.ward_name = w.name;
      }
      if (street_address) updates.street_address = street_address;
      if (is_default !== undefined) updates.is_default = Boolean(is_default);

      // Tính lại full_address nếu có thay đổi thông tin địa chỉ
      if (street_address || province_code || ward_code) {
        const existing = await identityRepository.getAddressById(address_id, req.user.id);
        if (existing) {
          const str = street_address || existing.street_address;
          const wName = updates.ward_name || existing.ward_name;
          const pName = updates.province_name || existing.province_name;
          updates.full_address = `${str}, ${wName}, ${pName}`;
        }
      }

      const updated = await identityRepository.updateAddress(address_id, req.user.id, updates);
      if (!updated) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy địa chỉ để cập nhật',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật địa chỉ thành công',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/me/addresses/:address_id (ADR04)
  static async deleteAddress(req, res, next) {
    try {
      const { address_id } = req.params;
      const result = await identityRepository.deleteAddress(address_id, req.user.id);

      if (!result) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy địa chỉ để xóa',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Xóa địa chỉ thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/me/addresses/:address_id/default (ADR05)
  static async setDefaultAddress(req, res, next) {
    try {
      const { address_id } = req.params;
      const result = await identityRepository.setDefaultAddress(address_id, req.user.id);

      if (!result) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy địa chỉ',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Đặt địa chỉ mặc định thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/locations/provinces (ADR06)
  static async getProvinces(req, res, next) {
    try {
      const provinces = getProvinces();
      return res.status(200).json({
        status: 'success',
        data: provinces,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/locations/wards (ADR07)
  static async getWards(req, res, next) {
    try {
      const { province_code } = req.query;
      const wards = getWardsByProvince(province_code);
      return res.status(200).json({
        status: 'success',
        data: wards,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AddressController;
