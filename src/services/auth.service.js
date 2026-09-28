import UserModel from '../models/user.model.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

class AuthService {
  // Logic đăng ký tài khoản
  static async register({ name, email, password }) {
    // 1. Kiểm tra email đã tồn tại hay chưa
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      const error = new Error('Email đã được sử dụng');
      error.statusCode = 400;
      throw error;
    }

    // 2. Băm mật khẩu
    const hashedPassword = await hashPassword(password);

    // 3. Lưu người dùng vào cơ sở dữ liệu (ID là UUID)
    const newUser = await UserModel.create({
      name,
      email,
      password: hashedPassword,
    });

    // 4. Tạo Access Token và Refresh Token
    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 5. Lưu rf_token vào database
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
    // 1. Tìm người dùng theo email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      const error = new Error('Email hoặc mật khẩu không chính xác');
      error.statusCode = 401;
      throw error;
    }

    // 2. So sánh mật khẩu
    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      const error = new Error('Email hoặc mật khẩu không chính xác');
      error.statusCode = 401;
      throw error;
    }

    // 3. Tạo Access Token và Refresh Token
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 4. Cập nhật rf_token vào database
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

  // Logic cấp mới Access Token từ Refresh Token
  static async refreshToken(incomingRefreshToken) {
    if (!incomingRefreshToken) {
      const error = new Error('Vui lòng cung cấp refreshToken (hoặc rf_token)');
      error.statusCode = 400;
      throw error;
    }

    // 1. Xác thực tính hợp lệ của Refresh Token
    let decoded;
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch (err) {
      const error = new Error('Refresh Token không hợp lệ hoặc đã hết hạn');
      error.statusCode = 403;
      throw error;
    }

    // 2. Kiểm tra Refresh Token có khớp trong DB không
    const user = await UserModel.findByRefreshToken(incomingRefreshToken);
    if (!user || user.id !== decoded.id) {
      const error = new Error('Refresh Token không tồn tại hoặc đã bị thu hồi');
      error.statusCode = 403;
      throw error;
    }

    // 3. Sinh Access Token mới và Refresh Token mới (Refresh Token Rotation)
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    // 4. Cập nhật rf_token mới vào DB
    await UserModel.updateRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // Logic đăng xuất: xóa rf_token trong database
  static async logout(userId) {
    await UserModel.updateRefreshToken(userId, null);
    return true;
  }
}

export default AuthService;
