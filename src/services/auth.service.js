import UserModel from '../models/user.model.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt.js';
import { isValidEmail, isValidPassword } from '../validations/auth.validation.js';
import lockManager from '../common/ports/ILockManager.js';

class AuthService {
  // Logic đăng ký tài khoản
  static async register({ name, email, password }) {
    if (!name || !name.trim()) {
      const error = new Error('Vui lòng cung cấp họ và tên');
      error.statusCode = 400;
      throw error;
    }

    if (!isValidEmail(email)) {
      const error = new Error('Email không đúng định dạng hợp lệ');
      error.statusCode = 400;
      throw error;
    }

    if (!isValidPassword(password)) {
      const error = new Error('Mật khẩu phải có ít nhất 6 ký tự');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // 1. Kiểm tra email đã tồn tại hay chưa
    const existingUser = await UserModel.findByEmail(cleanEmail);
    if (existingUser) {
      const error = new Error('Email đã được sử dụng');
      error.statusCode = 400;
      throw error;
    }

    // 2. Băm mật khẩu
    const hashedPassword = await hashPassword(password);

    // 3. Lưu người dùng vào cơ sở dữ liệu (ID là UUID, vai trò mặc định customer)
    const newUser = await UserModel.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      role: 'customer',
    });

    // 4. Tạo Access Token và Refresh Token
    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 5. Lưu rf_token vào database (model tự động hash SHA-256)
    await UserModel.updateRefreshToken(newUser.id, refreshToken);

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.created_at,
      },
      accessToken,
      refreshToken,
    };
  }

  // Logic đăng nhập
  static async login({ email, password }) {
    if (!email || !password) {
      const error = new Error('Vui lòng nhập đầy đủ email và mật khẩu');
      error.statusCode = 400;
      throw error;
    }

    if (!isValidEmail(email)) {
      const error = new Error('Email hoặc mật khẩu không chính xác');
      error.statusCode = 401;
      throw error;
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Tìm người dùng theo email
    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      const error = new Error('Email hoặc mật khẩu không chính xác');
      error.statusCode = 401;
      throw error;
    }

    // 2. Kiểm tra tài khoản có bị khóa/vô hiệu hóa không
    if (user.active === false) {
      const error = new Error('Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
      error.statusCode = 403;
      throw error;
    }

    // 3. So sánh mật khẩu
    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      const error = new Error('Email hoặc mật khẩu không chính xác');
      error.statusCode = 401;
      throw error;
    }

    // 4. Tạo Access Token và Refresh Token
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 5. Cập nhật rf_token vào database (model tự động hash SHA-256)
    await UserModel.updateRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      },
      accessToken,
      refreshToken,
    };
  }

  // Logic cấp mới Access Token từ Refresh Token (Refresh Token Rotation + Reuse Detection + Concurrency Safe)
  static async refreshToken(incomingRefreshToken) {
    if (!incomingRefreshToken || typeof incomingRefreshToken !== 'string') {
      const error = new Error('Vui lòng cung cấp refreshToken (hoặc rf_token)');
      error.statusCode = 400;
      throw error;
    }

    const trimmedToken = incomingRefreshToken.trim();

    // 1. Xác thực tính hợp lệ của Refresh Token
    let decoded;
    try {
      decoded = verifyRefreshToken(trimmedToken);
    } catch (err) {
      const error = new Error(err.message || 'Refresh Token không hợp lệ hoặc đã hết hạn');
      error.statusCode = 403;
      throw error;
    }

    // Xử lý chống race condition khi nhiều request refresh đồng thời (RFC 6819 Concurrency Mitigation)
    const tokenHash = hashToken(trimmedToken);

    return await lockManager.acquireAndExecute(tokenHash, async () => {
      // 2. Kiểm tra Refresh Token có khớp trong DB không
      const user = await UserModel.findByRefreshToken(trimmedToken);
      if (!user || user.id !== decoded.id) {
        // PHÁT HIỆN TÁI SỬ DỤNG TOKEN (Token Reuse Detection):
        // Chữ ký JWT hợp lệ và chưa hết hạn, nhưng token này không khớp với token đang lưu trong DB.
        // Điều này báo hiệu token cũ đã được xoay vòng hoặc bị kẻ gian đánh cắp và dùng lại.
        // Ngay lập tức thu hồi phiên làm việc hiện tại của user để bảo vệ tài khoản!
        if (decoded && decoded.id) {
          await UserModel.updateRefreshToken(decoded.id, null);
        }
        const error = new Error(
          'Cảnh báo bảo mật: Refresh Token không hợp lệ hoặc đã được sử dụng trước đó (nguy cơ bị chiếm đoạt). Toàn bộ phiên làm việc đã bị hủy, vui lòng đăng nhập lại.'
        );
        error.statusCode = 403;
        throw error;
      }

      // 3. Kiểm tra trạng thái tài khoản
      if (user.active === false) {
        await UserModel.updateRefreshToken(user.id, null);
        const error = new Error('Tài khoản đã bị khóa hoặc vô hiệu hóa');
        error.statusCode = 403;
        throw error;
      }

      // 4. Sinh Access Token mới và Refresh Token mới (Refresh Token Rotation - RTR)
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      const newAccessToken = generateAccessToken(payload);
      const newRefreshToken = generateRefreshToken(payload);

      // 5. Cập nhật rf_token mới vào DB
      await UserModel.updateRefreshToken(user.id, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });
  }

  // Logic đăng xuất: xóa rf_token trong database
  static async logout(userId) {
    if (!userId) return false;
    await UserModel.updateRefreshToken(userId, null);
    return true;
  }

  // Lấy thông tin tài khoản cá nhân hiện tại
  static async getMe(userId) {
    const user = await UserModel.findById(userId);
    if (!user) {
      const error = new Error('Không tìm thấy người dùng');
      error.statusCode = 404;
      throw error;
    }

    if (user.active === false) {
      const error = new Error('Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa');
      error.statusCode = 403;
      throw error;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      is_active: user.active !== false,
      default_address_id: user.default_address_id || null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  // Cập nhật thông tin cá nhân (name, phone)
  static async updateMe(userId, { name, phone }) {
    const user = await UserModel.findById(userId);
    if (!user) {
      const error = new Error('Không tìm thấy người dùng');
      error.statusCode = 404;
      throw error;
    }

    const fields = {};
    if (name && name.trim()) fields.name = name.trim();
    if (phone !== undefined) fields.phone = phone ? phone.trim() : null;

    const updated = await UserModel.update(userId, fields);
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone || null,
      role: updated.role,
      is_active: updated.active !== false,
      default_address_id: updated.default_address_id || null,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  // Đổi mật khẩu
  static async changePassword(userId, { current_password, new_password, new_password_confirmation }) {
    if (!current_password || !new_password) {
      const error = new Error('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới');
      error.statusCode = 400;
      throw error;
    }

    if (new_password.length < 6) {
      const error = new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
      error.statusCode = 400;
      throw error;
    }

    if (new_password_confirmation && new_password !== new_password_confirmation) {
      const error = new Error('Xác nhận mật khẩu mới không khớp');
      error.statusCode = 400;
      throw error;
    }

    const userWithPassword = await UserModel.findByEmail((await UserModel.findById(userId))?.email);
    if (!userWithPassword) {
      const error = new Error('Không tìm thấy người dùng');
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await comparePassword(current_password, userWithPassword.password);
    if (!isMatch) {
      const error = new Error('Mật khẩu hiện tại không chính xác');
      error.statusCode = 400;
      throw error;
    }

    const hashed = await hashPassword(new_password);
    const updated = await UserModel.updatePassword(userId, hashed);

    return {
      success: true,
      updated_at: updated?.updated_at || new Date().toISOString(),
    };
  }
}

export default AuthService;
