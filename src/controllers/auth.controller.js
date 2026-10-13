import AuthService from '../services/auth.service.js';

class AuthController {
  // POST /api/v1/auth/register & /api/v1/users/register (AUTH01)
  static async register(req, res, next) {
    try {
      const { name, email, password, password_confirmation } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp đầy đủ tên, email và mật khẩu',
        });
      }

      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Mật khẩu phải có ít nhất 6 ký tự',
        });
      }

      if (password_confirmation && password !== password_confirmation) {
        return res.status(400).json({
          status: 'error',
          message: 'Xác nhận mật khẩu không khớp',
        });
      }

      const result = await AuthService.register({ name, email, password });

      return res.status(201).json({
        status: 'success',
        message: 'Đăng ký tài khoản thành công',
        data: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          is_active: true,
          created_at: result.user.createdAt,
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/login & /api/v1/users/login (AUTH02)
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng nhập email và mật khẩu',
        });
      }

      const result = await AuthService.login({ email, password });
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return res.status(200).json({
        status: 'success',
        message: 'Đăng nhập thành công',
        data: {
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            phone: result.user.phone || null,
            role: result.user.role,
            is_active: result.user.active !== false,
            default_address_id: result.user.default_address_id || null,
          },
          expires_at: expiresAt,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /refresh-token (hoặc /rf-token)
  static async refreshToken(req, res, next) {
    try {
      const token = req.body?.refreshToken || req.body?.rf_token;

      if (!token) {
        return res.status(400).json({
          status: 'error',
          message: 'Vui lòng cung cấp refreshToken hoặc rf_token',
        });
      }

      const result = await AuthService.refreshToken(token);

      return res.status(200).json({
        status: 'success',
        message: 'Làm mới token thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/logout & /api/v1/users/logout (AUTH03)
  static async logout(req, res, next) {
    try {
      await AuthService.logout(req.user.id);

      return res.status(200).json({
        status: 'success',
        message: 'Đăng xuất thành công',
        data: {
          success: true,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/me & /api/v1/users/me (AUTH04)
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getMe(req.user.id);

      return res.status(200).json({
        status: 'success',
        data: {
          ...user,
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/me (AUTH05)
  static async updateMe(req, res, next) {
    try {
      const { name, phone } = req.body;
      const updatedUser = await AuthService.updateMe(req.user.id, { name, phone });

      return res.status(200).json({
        status: 'success',
        message: 'Cập nhật thông tin thành công',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/me/password (AUTH06)
  static async updatePassword(req, res, next) {
    try {
      const { current_password, new_password, new_password_confirmation } = req.body;
      const result = await AuthService.changePassword(req.user.id, {
        current_password,
        new_password,
        new_password_confirmation,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Đổi mật khẩu thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
