// Express 4 không tự bắt lỗi từ hàm async: chuyển mọi lỗi sang errorHandler qua next().
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
