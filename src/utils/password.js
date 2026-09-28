import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// Hàm băm mật khẩu
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

// Hàm so sánh mật khẩu nhập vào với mật khẩu đã băm
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};
