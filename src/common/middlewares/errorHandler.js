import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  const declaredStatus = Number(err.statusCode || err.status);
  const databaseErrors = {
    '22P02': [400, 'Định dạng dữ liệu không hợp lệ'],
    '22003': [400, 'Giá trị nằm ngoài phạm vi cho phép'],
    '23505': [409, 'Dữ liệu đã tồn tại'],
    '23503': [409, 'Dữ liệu liên quan không tồn tại hoặc đang được sử dụng'],
    '23514': [400, 'Dữ liệu không đáp ứng điều kiện hợp lệ'],
  };
  const databaseError = databaseErrors[err.code];
  const statusCode = declaredStatus >= 400 && declaredStatus <= 599
    ? declaredStatus
    : (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT' ? 413 :
      (err.name === 'MulterError' ? 400 : (databaseError?.[0] || 500)));

  if (statusCode >= 500) {
    logger.error(`Unhandled Server Error: ${err.message}`, err, {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  const message = statusCode >= 500
    ? 'Có lỗi xảy ra. Vui lòng thử lại sau.'
    : (databaseError?.[1] || err.message || 'Yêu cầu không hợp lệ');
  return res.status(statusCode).json({
    status: 'error',
    message,
    // Lý do nghiệp vụ dạng mã (vd. review chưa đủ điều kiện) để FE hiển thị phù hợp
    ...(statusCode < 500 && err.reason ? { reason: err.reason } : {}),
  });
};

export default errorHandler;
