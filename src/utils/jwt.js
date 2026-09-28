import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'default_access_secret_key';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_key';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Tạo Access Token (thời hạn ngắn, vd: 15m)
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
};

// Tạo Refresh Token (thời hạn dài, vd: 7d)
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
};

// Xác thực Access Token
export const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

// Xác thực Refresh Token
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

// Giữ lại tương thích ngược
export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;
