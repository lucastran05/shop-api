import identityRepository from '../modules/identity/identity.repository.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt.js';
import { isValidEmail, isValidPassword } from '../validations/auth.validation.js';
import lockManager from '../common/ports/ILockManager.js';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../common/errors/AppError.js';
import { toProfileView } from '../modules/identity/userView.js';
import { randomBytes } from 'node:crypto';
import { passwordResetMail, passwordResetUrl } from './password-reset-mail.js';
import logger from '../common/utils/logger.js';

class AuthService {
  // Logic đăng ký tài khoản
  static async register({ name, email, password }) {
    if (!name || !name.trim()) {
      throw new BadRequestError('Vui lòng cung cấp họ và tên');
    }

    if (!isValidEmail(email)) {
      throw new BadRequestError('Email không đúng định dạng hợp lệ');
    }

    if (!isValidPassword(password)) {
      throw new BadRequestError('Mật khẩu phải có ít nhất 6 ký tự');
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // 1. Kiểm tra email đã tồn tại hay chưa
    const existingUser = await identityRepository.findByEmail(cleanEmail);
    if (existingUser) {
      throw new BadRequestError('Email đã được sử dụng');
    }

    // 2. Băm mật khẩu
    const hashedPassword = await hashPassword(password);

    // 3. Lưu người dùng vào cơ sở dữ liệu (ID là UUID, vai trò mặc định customer)
    const newUser = await identityRepository.create({
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
      token_version: newUser.token_version ?? 0,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 5. Lưu rf_token vào database (model tự động hash SHA-256)
    await identityRepository.updateRefreshToken(newUser.id, refreshToken);

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
      throw new BadRequestError('Vui lòng nhập đầy đủ email và mật khẩu');
    }

    if (!isValidEmail(email)) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Tìm người dùng theo email
    const user = await identityRepository.findByEmail(cleanEmail);
    if (!user) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    // 2. Kiểm tra tài khoản có bị khóa/vô hiệu hóa không
    if (user.active === false) {
      throw new ForbiddenError('Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
    }

    // 3. So sánh mật khẩu
    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    // 4. Tạo Access Token và Refresh Token
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      token_version: user.token_version ?? 0,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 5. Cập nhật rf_token vào database (model tự động hash SHA-256)
    await identityRepository.updateRefreshToken(user.id, refreshToken);

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
      throw new BadRequestError('Vui lòng cung cấp refreshToken (hoặc rf_token)');
    }

    const trimmedToken = incomingRefreshToken.trim();

    // 1. Xác thực tính hợp lệ của Refresh Token
    let decoded;
    try {
      decoded = verifyRefreshToken(trimmedToken);
    } catch (err) {
      throw new ForbiddenError(err.message || 'Refresh Token không hợp lệ hoặc đã hết hạn');
    }

    // Xử lý chống race condition khi nhiều request refresh đồng thời (RFC 6819 Concurrency Mitigation)
    const tokenHash = hashToken(trimmedToken);

    return await lockManager.acquireAndExecute(tokenHash, async () => {
      // 2. Kiểm tra Refresh Token có khớp trong DB không
      const user = await identityRepository.findByRefreshToken(trimmedToken);
      const currentUser = user || await identityRepository.findById(decoded.id);
      if (currentUser && (decoded.token_version ?? 0) !== currentUser.token_version) {
        throw new ForbiddenError('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
      }
      if (!user || user.id !== decoded.id) {
        // PHÁT HIỆN TÁI SỬ DỤNG TOKEN (Token Reuse Detection):
        // Chữ ký JWT hợp lệ và chưa hết hạn, nhưng token này không khớp với token đang lưu trong DB.
        // Điều này báo hiệu token cũ đã được xoay vòng hoặc bị kẻ gian đánh cắp và dùng lại.
        // Ngay lập tức thu hồi phiên làm việc hiện tại của user để bảo vệ tài khoản!
        if (decoded && decoded.id) {
          await identityRepository.updateRefreshToken(decoded.id, null);
        }
        throw new ForbiddenError('Cảnh báo bảo mật: Refresh Token không hợp lệ hoặc đã được sử dụng trước đó (nguy cơ bị chiếm đoạt). Toàn bộ phiên làm việc đã bị hủy, vui lòng đăng nhập lại.');
      }

      // 3. Kiểm tra trạng thái tài khoản
      if (user.active === false) {
        await identityRepository.updateRefreshToken(user.id, null);
        throw new ForbiddenError('Tài khoản đã bị khóa hoặc vô hiệu hóa');
      }

      // 4. Sinh Access Token mới và Refresh Token mới (Refresh Token Rotation - RTR)
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        token_version: user.token_version ?? 0,
      };
      const newAccessToken = generateAccessToken(payload);
      const newRefreshToken = generateRefreshToken(payload);

      // 5. Cập nhật rf_token mới vào DB
      await identityRepository.updateRefreshToken(user.id, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });
  }

  static async forgotPassword({ email } = {}) {
    if (!isValidEmail(email) || email.length > 255) {
      throw new BadRequestError('Email không đúng định dạng hợp lệ');
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const url = passwordResetUrl(token);
    const user = await identityRepository.createPasswordReset(email.trim().toLowerCase(), tokenHash);
    if (user) {
      try {
        await passwordResetMail.send(user.email, url);
      } catch {
        await identityRepository.cancelPasswordReset(tokenHash);
        // Do not reveal account existence or put reset links in logs.
        logger.warn('Password reset email delivery failed. Check SMTP configuration and availability.');
      }
    }
    return { success: true };
  }

  static async resetPassword({ token, password, password_confirmation } = {}) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      throw new BadRequestError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    if (!isValidPassword(password) || Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestError('Mật khẩu phải có ít nhất 6 ký tự và không vượt quá 72 byte');
    }
    if (password !== password_confirmation) {
      throw new BadRequestError('Xác nhận mật khẩu không khớp');
    }
    const updated = await identityRepository.resetPassword(hashToken(token), await hashPassword(password));
    if (!updated) {
      throw new BadRequestError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    return { success: true };
  }

  // Logic đăng xuất: xóa rf_token trong database
  static async logout(userId) {
    if (!userId) return false;
    await identityRepository.updateRefreshToken(userId, null);
    return true;
  }

  // Lấy thông tin tài khoản cá nhân hiện tại
  static async getMe(userId) {
    const user = await identityRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    if (user.active === false) {
      throw new ForbiddenError('Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa');
    }

    return toProfileView(user);
  }

  // Cập nhật thông tin cá nhân (name, phone)
  static async updateMe(userId, { name, phone }) {
    const user = await identityRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    const fields = {};
    if (name && name.trim()) fields.name = name.trim();
    if (phone !== undefined) fields.phone = phone ? phone.trim() : null;

    const updated = await identityRepository.update(userId, fields);
    return toProfileView(updated);
  }

  // Đổi mật khẩu
  static async changePassword(userId, { current_password, new_password, new_password_confirmation }) {
    if (!current_password || !new_password) {
      throw new BadRequestError('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới');
    }

    if (new_password.length < 6) {
      throw new BadRequestError('Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    if (new_password_confirmation && new_password !== new_password_confirmation) {
      throw new BadRequestError('Xác nhận mật khẩu mới không khớp');
    }

    const userWithPassword = await identityRepository.findByEmail((await identityRepository.findById(userId))?.email);
    if (!userWithPassword) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    const isMatch = await comparePassword(current_password, userWithPassword.password);
    if (!isMatch) {
      throw new BadRequestError('Mật khẩu hiện tại không chính xác');
    }

    const hashed = await hashPassword(new_password);
    const updated = await identityRepository.updatePassword(userId, hashed);

    return {
      success: true,
      updated_at: updated?.updated_at || new Date().toISOString(),
    };
  }
}

export default AuthService;
