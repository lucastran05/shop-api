import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'default_access_secret_key';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_key';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Cảnh báo nếu sử dụng secret mặc định trong môi trường production
if (process.env.NODE_ENV === 'production') {
  if (ACCESS_SECRET === 'default_access_secret_key' || REFRESH_SECRET === 'default_refresh_secret_key') {
    console.warn('⚠️ CẢNH BÁO BẢO MẬT: Đang sử dụng JWT Secret mặc định trong môi trường Production!');
  }
}

/**
 * Hàm băm token bằng SHA-256 để lưu an toàn vào cơ sở dữ liệu
 * Tránh việc lưu Refresh Token dưới dạng plain-text
 */
export const hashToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
};

/**
 * Tạo Access Token (thời hạn ngắn, vd: 15m)
 * Đính kèm claim token_type = 'access' và jti duy nhất chống replay
 */
export const generateAccessToken = (payload) => {
  const tokenPayload = {
    ...payload,
    token_type: 'access',
  };

  return jwt.sign(tokenPayload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  });
};

/**
 * Tạo Refresh Token (thời hạn dài, vd: 7d)
 * Đính kèm claim token_type = 'refresh' và jti duy nhất chống replay
 */
export const generateRefreshToken = (payload) => {
  const tokenPayload = {
    id: payload.id,
    token_type: 'refresh',
  };

  return jwt.sign(tokenPayload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  });
};

/**
 * Xác thực Access Token
 * Từ chối nếu token_type là 'refresh' hoặc chữ ký không khớp
 */
export const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, ACCESS_SECRET);
  if (decoded.token_type && decoded.token_type !== 'access') {
    const error = new Error('Token không hợp lệ (Không phải là Access Token)');
    error.statusCode = 401;
    throw error;
  }
  return decoded;
};

/**
 * Xác thực Refresh Token
 * Từ chối nếu token_type là 'access' hoặc chữ ký không khớp
 */
export const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, REFRESH_SECRET);
  if (decoded.token_type && decoded.token_type !== 'refresh') {
    const error = new Error('Token không hợp lệ (Không phải là Refresh Token)');
    error.statusCode = 403;
    throw error;
  }
  return decoded;
};

// Giữ lại tương thích ngược với mã nguồn cũ
export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;
