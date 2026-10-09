import AuthService from '../services/auth.service.js';
import UserModel from '../models/user.model.js';

class AuthController {
  // POST /register
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body;

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

      const result = await AuthService.register({ name, email, password });

      return res.status(201).json({
        status: 'success',
        message: 'Đăng ký tài khoản thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /login
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

      return res.status(200).json({
        status: 'success',
        message: 'Đăng nhập thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /refresh-token (hoặc /rf-token)
  static async refreshToken(req, res, next) {
    try {
      // Hỗ trợ cả 2 định dạng field: refreshToken hoặc rf_token
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

  // POST /logout
  static async logout(req, res, next) {
    try {
      await AuthService.logout(req.user.id);

      return res.status(200).json({
        status: 'success',
        message: 'Đăng xuất thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /me
  static async getMe(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy người dùng',
        });
      }

      if (user.active === false) {
        return res.status(403).json({
          status: 'error',
          message: 'Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
