export const sendSuccess = (res, { data, message, statusCode = 200 } = {}) => {
  const response = {
    status: 'success',
  };

  if (message) {
    response.message = message;
  }

  if (data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

export const sendError = (res, { message = 'Internal Server Error', statusCode = 500, details } = {}) => {
  const response = {
    status: 'error',
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

export default {
  sendSuccess,
  sendError,
};
