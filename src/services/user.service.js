import identityRepository from '../modules/identity/identity.repository.js';
import { hashPassword } from '../utils/password.js';
import { isValidEmail } from '../validations/auth.validation.js';

class UserService {
  // Lấy danh sách người dùng
  static async getAllUsers(filters) {
    return await identityRepository.findAll(filters);
  }

  // Lấy thông tin người dùng theo ID
  static async getUserById(id) {
    const user = await identityRepository.findById(id);
    if (!user) {
      const error = new Error('Không tìm thấy người dùng');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }

  // Tạo người dùng mới
  static async createUser({ name, email, password, role, phone, address, avatar, active }) {
    if (!isValidEmail(email)) {
      const error = new Error('Email không đúng định dạng hợp lệ');
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Kiểm tra email đã tồn tại hay chưa
    const existing = await identityRepository.findByEmail(cleanEmail);
    if (existing) {
      const error = new Error('Email đã được sử dụng');
      error.statusCode = 400;
      throw error;
    }

    // 2. Băm mật khẩu (mặc định '123456' nếu không truyền)
    const rawPassword = password || '123456';
    const hashedPassword = await hashPassword(rawPassword);

    // 3. Tạo trong DB
    const newUser = await identityRepository.create({
      name,
      email: cleanEmail,
      password: hashedPassword,
      role: role || 'customer',
      phone,
      address,
      avatar,
      active: active !== undefined ? active : true,
    });

    return newUser;
  }

  // Cập nhật người dùng
  static async updateUser(id, updateData) {
    // Kiểm tra user có tồn tại không
    const user = await identityRepository.findById(id);
    if (!user) {
      const error = new Error('Không tìm thấy người dùng để cập nhật');
      error.statusCode = 404;
      throw error;
    }

    const fieldsToUpdate = {};

    if (updateData.name !== undefined) fieldsToUpdate.name = updateData.name;
    if (updateData.role !== undefined) fieldsToUpdate.role = updateData.role;
    if (updateData.phone !== undefined) fieldsToUpdate.phone = updateData.phone;
    if (updateData.address !== undefined) fieldsToUpdate.address = updateData.address;
    if (updateData.avatar !== undefined) fieldsToUpdate.avatar = updateData.avatar;
    if (updateData.active !== undefined) fieldsToUpdate.active = updateData.active;

    // Nếu cập nhật email, kiểm tra xem có bị trùng với user khác không
    if (updateData.email && updateData.email !== user.email) {
      const cleanEmail = updateData.email.toLowerCase().trim();
      const existing = await identityRepository.findByEmail(cleanEmail);
      if (existing && existing.id !== id) {
        const error = new Error('Email đã được người dùng khác sử dụng');
        error.statusCode = 400;
        throw error;
      }
      fieldsToUpdate.email = cleanEmail;
    }

    let passwordChanged = false;
    // Nếu cập nhật mật khẩu, cần băm mật khẩu mới
    if (updateData.password) {
      if (updateData.password.length < 6) {
        const error = new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
        error.statusCode = 400;
        throw error;
      }
      fieldsToUpdate.password = await hashPassword(updateData.password);
      passwordChanged = true;
    }

    const updatedUser = await identityRepository.update(id, fieldsToUpdate);

    // BẢO MẬT PHIÊN ĐĂNG NHẬP:
    // Nếu mật khẩu thay đổi hoặc tài khoản bị vô hiệu hóa (active = false),
    // ngay lập tức thu hồi Refresh Token trong DB để vô hiệu hóa các phiên đăng nhập cũ
    if (passwordChanged || updateData.active === false) {
      await identityRepository.updateRefreshToken(id, null);
    }

    return updatedUser;
  }

  // Xóa người dùng
  static async deleteUser(id) {
    const user = await identityRepository.findById(id);
    if (!user) {
      const error = new Error('Không tìm thấy người dùng để xóa');
      error.statusCode = 404;
      throw error;
    }

    return await identityRepository.delete(id);
  }
}

export default UserService;
