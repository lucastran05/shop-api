import AuthService from '../services/auth.service.js';
import { BadRequestError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class AuthController {
  static forgotPassword = asyncHandler(async (req, res) => {
    const result = await AuthService.forgotPassword(req.body);
    return res.status(200).json({
      status: 'success',
      message: 'Nếu email thuộc tài khoản đang hoạt động, bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.',
      data: result,
    });
  });

  static resetPassword = asyncHandler(async (req, res) => {
    const result = await AuthService.resetPassword(req.body);
    return res.status(200).json({
      status: 'success',
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
      data: result,
    });
  });

  // POST /api/v1/auth/register & /api/v1/users/register (AUTH01)
  static register = asyncHandler(async (req, res) => {
    const { name, email, password, password_confirmation } = req.body;

    if (!name || !email || !password) {
      throw new BadRequestError('Vui lòng cung cấp đầy đủ tên, email và mật khẩu');
    }

    if (typeof password !== 'string' || password.length < 6) {
      throw new BadRequestError('Mật khẩu phải có ít nhất 6 ký tự');
    }

    if (password_confirmation && password !== password_confirmation) {
      throw new BadRequestError('Xác nhận mật khẩu không khớp');
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
  });

  // POST /api/v1/auth/login & /api/v1/users/login (AUTH02)
  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Vui lòng nhập email và mật khẩu');
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
  });

  // POST /refresh-token (hoặc /rf-token)
  static refreshToken = asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken || req.body?.rf_token;

    if (!token) {
      throw new BadRequestError('Vui lòng cung cấp refreshToken hoặc rf_token');
    }

    const result = await AuthService.refreshToken(token);

    return res.status(200).json({
      status: 'success',
      message: 'Làm mới token thành công',
      data: result,
    });
  });

  // POST /api/v1/auth/logout & /api/v1/users/logout (AUTH03)
  static logout = asyncHandler(async (req, res) => {
    await AuthService.logout(req.user.id);

    return res.status(200).json({
      status: 'success',
      message: 'Đăng xuất thành công',
      data: {
        success: true,
      },
    });
  });

  // GET /api/v1/me & /api/v1/users/me (AUTH04)
  static getMe = asyncHandler(async (req, res) => {
    const user = await AuthService.getMe(req.user.id);

    return res.status(200).json({
      status: 'success',
      data: {
        ...user,
        user,
      },
    });
  });

  // PATCH /api/v1/me (AUTH05)
  static updateMe = asyncHandler(async (req, res) => {
    const { name, phone } = req.body;
    const updatedUser = await AuthService.updateMe(req.user.id, { name, phone });

    return res.status(200).json({
      status: 'success',
      message: 'Cập nhật thông tin thành công',
      data: updatedUser,
    });
  });

  // PUT /api/v1/me/password (AUTH06)
  static updatePassword = asyncHandler(async (req, res) => {
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
  });
}

export default AuthController;
