import UserService from '../services/user.service.js';
import IdentityPolicy from '../modules/identity/identity.policy.js';
import identityRepository from '../modules/identity/identity.repository.js';
import { hashPassword } from '../utils/password.js';

class UserController {
  // GET /api/v1/users (Chỉ Admin / Manager)
  static async getAll(req, res, next) {
    try {
      const { page, limit, search, role, active } = req.query;
      const result = await UserService.getAllUsers({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        search,
        role,
        active,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/users/:id (Chủ tài khoản hoặc Admin / Manager)
  static async getById(req, res, next) {
    try {
      const { id } = req.params;

      if (!IdentityPolicy.canViewUser(req.user, id)) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền xem thông tin của người dùng này',
        });
      }

      const user = await UserService.getUserById(id);

      return res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/users (Chỉ Admin)
  static async create(req, res, next) {
    try {
      const { name, email, password, role, phone, address, avatar, active } = req.body;

      if (!name || !email) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp tên và email',
        });
      }

      const user = await UserService.createUser({
        name,
        email,
        password,
        role,
        phone,
        address,
        avatar,
        active,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Tạo người dùng thành công',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/users/:id (Chủ tài khoản hoặc Admin)
  static async update(req, res, next) {
    try {
      const { id } = req.params;

      if (!IdentityPolicy.canUpdateUser(req.user, id)) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền chỉnh sửa thông tin người dùng khác',
        });
      }

      const updatePayload = IdentityPolicy.sanitizeUpdatePayload(req.user, req.body);
      const updatedUser = await UserService.updateUser(id, updatePayload);

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật thông tin người dùng thành công',
        data: { user: updatedUser },
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/users/:id (Chỉ Admin)
  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user && req.user.id === id) {
        return res.status(400).json({
          status: 'error',
          message: 'Không thể xóa tài khoản của chính bạn đang sử dụng',
        });
      }

      await UserService.deleteUser(id);

      return res.status(200).json({
        status: 'success',
        message: 'Xóa người dùng thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  // --- Admin Contract USR01 - USR05 (Chỉ Admin) ---

  // GET /admin/users (USR01)
  static async adminGetUsers(req, res, next) {
    try {
      const { keyword, search, role, is_active, active, page, limit } = req.query;

      const result = await identityRepository.findAll({
        search: keyword || search || '',
        role,
        active: is_active !== undefined ? is_active : active,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      const formatted = result.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        role: u.role,
        is_active: u.active !== false,
        created_at: u.created_at,
        updated_at: u.updated_at,
      }));

      return res.status(200).json({
        status: 'success',
        data: formatted,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          total_pages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/users (USR02)
  static async adminCreateUser(req, res, next) {
    try {
      const { name, email, password, role, is_active, active } = req.body;

      if (!name || !email) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp họ tên và email',
        });
      }

      const existing = await identityRepository.findByEmail(email);
      if (existing) {
        return res.status(400).json({
          status: 'error',
          message: 'Email đã tồn tại trong hệ thống',
        });
      }

      const rawPassword = password || 'Abc@123456';
      const hashedPassword = await hashPassword(rawPassword);

      const created = await identityRepository.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: role || 'customer',
        active: is_active !== undefined ? is_active : (active !== undefined ? active : true),
      });

      return res.status(201).json({
        status: 'success',
        message: 'Tạo tài khoản quản trị thành công',
        data: {
          id: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone || null,
          role: created.role,
          is_active: created.active !== false,
          created_at: created.created_at,
          updated_at: created.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /admin/users/:user_id (USR03)
  static async adminUpdateUser(req, res, next) {
    try {
      const { user_id } = req.params;
      const { name, email, phone, role, is_active, active } = req.body;

      const target = await identityRepository.findById(user_id);
      if (!target) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy người dùng',
        });
      }

      // Ngăn tự hạ quyền chính mình gây mất quyền truy cập
      if (req.user?.id === user_id && role && role !== 'admin') {
        return res.status(400).json({
          status: 'error',
          message: 'Không thể tự hạ quyền quản trị viên của chính bạn',
        });
      }

      const updates = {};
      if (name) updates.name = name.trim();
      if (email) updates.email = email.trim().toLowerCase();
      if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
      if (role) updates.role = role;
      if (is_active !== undefined) updates.active = Boolean(is_active);
      else if (active !== undefined) updates.active = Boolean(active);

      const updated = await identityRepository.update(user_id, updates);

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật tài khoản thành công',
        data: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone || null,
          role: updated.role,
          is_active: updated.active !== false,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /admin/users/:user_id (USR04)
  static async adminDeleteUser(req, res, next) {
    try {
      const { user_id } = req.params;

      const target = await identityRepository.findById(user_id);
      if (!target) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy người dùng',
        });
      }

      // Theo phiếu yêu cầu: Mọi tài khoản admin đều chỉ được sửa, không được xóa!
      if (target.role === 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Không được phép xóa tài khoản quản trị viên (Admin)',
        });
      }

      await identityRepository.delete(user_id);

      return res.status(200).json({
        status: 'success',
        message: 'Xóa tài khoản thành công',
        data: {
          deleted_id: user_id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /admin/users/bulk-delete (USR05)
  static async adminBulkDelete(req, res, next) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp danh sách ID tài khoản cần xóa',
        });
      }

      const deleted_ids = [];
      const failed = [];

      for (const id of ids) {
        try {
          const target = await identityRepository.findById(id);
          if (!target) {
            failed.push({ id, code: 'NOT_FOUND', message: 'Không tìm thấy người dùng' });
            continue;
          }

          if (target.role === 'admin') {
            failed.push({ id, code: 'FORBIDDEN', message: 'Không được phép xóa tài khoản quản trị viên (Admin)' });
            continue;
          }

          if (req.user?.id === id) {
            failed.push({ id, code: 'SELF_DELETE', message: 'Không thể xóa tài khoản của chính bạn' });
            continue;
          }

          await identityRepository.delete(id);
          deleted_ids.push(id);
        } catch (err) {
          failed.push({ id, code: 'ERROR', message: err.message });
        }
      }

      return res.status(200).json({
        status: 'success',
        message: `Đã xử lý xóa ${deleted_ids.length} tài khoản`,
        data: {
          deleted_ids,
          failed,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default UserController;
