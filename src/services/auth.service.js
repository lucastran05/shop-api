import UserModel from '../models/user.model.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt.js';
import { isValidEmail, isValidPassword } from '../validations/auth.validation.js';

// Map lưu các tác vụ refresh token đang chạy để xử lý race condition khi nhiều request đồng thời
const inFlightRefreshes = new Map();

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
    if (inFlightRefreshes.has(tokenHash)) {
      return await inFlightRefreshes.get(tokenHash);
    }

    const refreshPromise = (async () => {
      try {
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
      } finally {
        inFlightRefreshes.delete(tokenHash);
      }
    })();

    inFlightRefreshes.set(tokenHash, refreshPromise);
    return await refreshPromise;
  }

  // Logic đăng xuất: xóa rf_token trong database
  static async logout(userId) {
    if (!userId) return false;
    await UserModel.updateRefreshToken(userId, null);
    return true;
  }
}

export default AuthService;
