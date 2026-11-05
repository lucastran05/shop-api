import UserService from '../services/user.service.js';
import IdentityPolicy from '../modules/identity/identity.policy.js';
import identityRepository from '../modules/identity/identity.repository.js';
import { hashPassword } from '../utils/password.js';
import { toUserView } from '../modules/identity/userView.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

const ASSIGNABLE_ROLES = ['customer', 'manager', 'admin'];

class UserController {
  // GET /api/v1/users (Chỉ Admin / Manager)
  static getAll = asyncHandler(async (req, res) => {
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
  });

  // GET /api/v1/users/:id (Chủ tài khoản hoặc Admin / Manager)
  static getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!IdentityPolicy.canViewUser(req.user, id)) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin của người dùng này');
    }

    const user = await UserService.getUserById(id);

    return res.status(200).json({
      status: 'success',
      data: { user },
    });
  });

  // POST /api/v1/users (Chỉ Admin)
  static create = asyncHandler(async (req, res) => {
    const { name, email, password, role, phone, address, avatar, active } = req.body;

    if (!name || !email || typeof password !== 'string' || password.length < 6) {
      throw new BadRequestError('Vui lòng cung cấp tên, email và mật khẩu (ít nhất 6 ký tự)');
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
  });

  // PUT /api/v1/users/:id (Chủ tài khoản hoặc Admin)
  static update = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!IdentityPolicy.canUpdateUser(req.user, id)) {
      throw new ForbiddenError('Bạn không có quyền chỉnh sửa thông tin người dùng khác');
    }

    const updatePayload = IdentityPolicy.sanitizeUpdatePayload(req.user, req.body);
    const updatedUser = await UserService.updateUser(id, updatePayload);

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật thông tin người dùng thành công',
      data: { user: updatedUser },
    });
  });

  // DELETE /api/v1/users/:id (Chỉ Admin)
  static delete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.user && req.user.id === id) {
      throw new BadRequestError('Không thể xóa tài khoản của chính bạn đang sử dụng');
    }

    await UserService.deleteUser(id);

    return res.status(200).json({
      status: 'success',
      message: 'Xóa người dùng thành công',
    });
  });

  // --- Admin Contract USR01 - USR05 (Chỉ Admin) ---

  // GET /admin/users (USR01)
  static adminGetUsers = asyncHandler(async (req, res) => {
    const { keyword, search, role, is_active, active, page, limit } = req.query;

    const result = await identityRepository.findAll({
      search: keyword || search || '',
      role,
      active: is_active !== undefined ? is_active : active,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    const formatted = result.users.map(toUserView);

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
  });

  // POST /admin/users (USR02)
  static adminCreateUser = asyncHandler(async (req, res) => {
    const { name, email, password, role, is_active, active } = req.body;

    if (!name || !email || typeof password !== 'string' || password.length < 6) {
      throw new BadRequestError('Vui lòng cung cấp họ tên, email và mật khẩu (ít nhất 6 ký tự)');
    }

    if (role && !ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestError('Invalid role');
    }

    const existing = await identityRepository.findByEmail(email);
    if (existing) {
      throw new BadRequestError('Email đã tồn tại trong hệ thống');
    }

    const hashedPassword = await hashPassword(password);

    const created = await identityRepository.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: ASSIGNABLE_ROLES.includes(role) ? role : 'customer',
      active: is_active !== undefined ? is_active : (active !== undefined ? active : true),
    });

    return res.status(201).json({
      status: 'success',
      message: 'Tạo tài khoản quản trị thành công',
      data: toUserView(created),
    });
  });

  // PATCH /admin/users/:user_id (USR03)
  static adminUpdateUser = asyncHandler(async (req, res) => {
    const { user_id } = req.params;
    const { name, email, phone, role, password, is_active, active } = req.body;

    const target = await identityRepository.findById(user_id);
    if (!target) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Ngăn tự hạ quyền chính mình gây mất quyền truy cập
    if (req.user?.id === user_id && role && role !== 'admin') {
      throw new BadRequestError('Không thể tự hạ quyền quản trị viên của chính bạn');
    }

    const nextActive = is_active ?? active;
    if (req.user?.id === user_id && nextActive !== undefined && !nextActive) {
      throw new BadRequestError('Không thể tự khóa tài khoản quản trị viên của chính bạn');
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (role) {
      if (!ASSIGNABLE_ROLES.includes(role)) {
        throw new BadRequestError('Invalid role');
      }
      updates.role = role;
    }
    if (nextActive !== undefined) updates.active = Boolean(nextActive);

    let passwordChanged = false;
    if (password !== undefined && password !== null && password !== "") {
      if (typeof password !== "string" || password.length < 6) {
        throw new BadRequestError("Mật khẩu mới phải có ít nhất 6 ký tự");
      }
      updates.password = await hashPassword(password);
      passwordChanged = true;
    }

    const updated = await identityRepository.update(user_id, updates);
    if (passwordChanged || updates.active === false) await identityRepository.updateRefreshToken(user_id, null);

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật tài khoản thành công',
      data: toUserView(updated),
    });
  });

  // DELETE /admin/users/:user_id (USR04)
  static adminDeleteUser = asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    const target = await identityRepository.findById(user_id);
    if (!target) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Theo phiếu yêu cầu: Mọi tài khoản admin đều chỉ được sửa, không được xóa!
    if (target.role === 'admin') {
      throw new ForbiddenError('Không được phép xóa tài khoản quản trị viên (Admin)');
    }

    await identityRepository.delete(user_id);

    return res.status(200).json({
      status: 'success',
      message: 'Xóa tài khoản thành công',
      data: {
        deleted_id: user_id,
      },
    });
  });

  // POST /admin/users/bulk-delete (USR05)
  static adminBulkDelete = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('Vui lòng cung cấp danh sách ID tài khoản cần xóa');
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
  });
}

export default UserController;
