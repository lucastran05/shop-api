import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    logger.error(`Unhandled Server Error: ${err.message}`, err, {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  return res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
};

export default errorHandler;
