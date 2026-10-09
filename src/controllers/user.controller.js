import UserService from '../services/user.service.js';

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

      // Kiểm tra quyền: Chỉ cho phép xem nếu là chính mình hoặc là admin/manager
      const isPrivileged = ['admin', 'manager'].includes(req.user?.role);
      const isOwner = req.user?.id === id;

      if (!isPrivileged && !isOwner) {
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

      const isAdmin = req.user?.role === 'admin';
      const isOwner = req.user?.id === id;

      // Không cho phép sửa thông tin người khác trừ khi là Admin
      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền chỉnh sửa thông tin người dùng khác',
        });
      }

      const updatePayload = { ...req.body };

      // Chống leo thang đặc quyền: Người dùng không phải Admin không được phép thay đổi vai trò (role) hoặc trạng thái (active)
      if (!isAdmin) {
        delete updatePayload.role;
        delete updatePayload.active;
      }

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

      // Không cho phép user tự xóa chính mình nếu đang đăng nhập
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
}

export default UserController;
