// Bộ nhớ đệm lưu trữ số lượt gọi API trong RAM
const rateLimitMap = new Map();

// Tự động dọn dẹp các bản ghi quá hạn mỗi 5 phút để tránh rò rỉ bộ nhớ
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Middleware giới hạn tần suất gửi yêu cầu (Rate Limiter)
 * @param {Object} options
 * @param {number} options.windowMs Thời gian cửa sổ tính bằng milliseconds (mặc định: 15 phút)
 * @param {number} options.max Số lượt yêu cầu tối đa cho phép trong cửa sổ thời gian
 * @param {string} options.message Thông báo trả về khi vượt quá giới hạn
 */
export const rateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
} = {}) => {
  return (req, res, next) => {
    // Không áp dụng rate limit khi chạy unit test
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    let record = rateLimitMap.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitMap.set(key, record);
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        status: 'error',
        message,
        retryAfter: retryAfterSeconds,
      });
    }

    next();
  };
};

// Cấu hình riêng cho các endpoint nhạy cảm
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 30, // Tối đa 30 lần thử
  message: 'Quá nhiều yêu cầu từ địa chỉ này. Vui lòng thử lại sau 15 phút.',
});
