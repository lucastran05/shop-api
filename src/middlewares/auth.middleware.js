import { verifyAccessToken } from '../utils/jwt.js';
import identityRepository from '../modules/identity/identity.repository.js';
import { ForbiddenError, UnauthorizedError } from '../common/errors/AppError.js';

async function authenticatedUser(req) {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
  if (!match) throw new UnauthorizedError();
  let decoded;
  try {
    decoded = verifyAccessToken(match[1]);
  } catch {
    throw new UnauthorizedError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  }
  const user = await identityRepository.findById(decoded.id);
  if (!user || user.active === false) throw new UnauthorizedError('Tài khoản không còn hoạt động');
  if ((decoded.token_version ?? 0) !== user.token_version) {
    throw new UnauthorizedError('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
  }
  return { ...decoded, id: user.id, email: user.email, role: user.role };
}

export async function verifyAuth(req, res, next) {
  try {
    req.user = await authenticatedUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) throw new UnauthorizedError('Bạn chưa đăng nhập');
  if (!roles.includes(req.user.role)) throw new ForbiddenError('Bạn không có quyền thực hiện hành động này');
  next();
};

export async function optionalAuth(req, res, next) {
  try {
    if (req.headers.authorization) req.user = await authenticatedUser(req);
    next();
  } catch (error) {
    if (error.statusCode === 401) return next();
    next(error);
  }
}
