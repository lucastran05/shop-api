import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  const declaredStatus = Number(err.statusCode || err.status);
  const statusCode = declaredStatus >= 400 && declaredStatus <= 599
    ? declaredStatus
    : (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT' ? 413 :
      (err.name === 'MulterError' ? 400 : 500));

  if (statusCode >= 500) {
    logger.error(`Unhandled Server Error: ${err.message}`, err, {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  const message = statusCode >= 500
    ? 'Có lỗi xảy ra. Vui lòng thử lại sau.'
    : (err.message || 'Yêu cầu không hợp lệ');
  return res.status(statusCode).json({
    status: 'error',
    message,
  });
};

export default errorHandler;
