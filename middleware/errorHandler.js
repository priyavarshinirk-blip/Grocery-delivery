const AppError = require('../utils/AppError');

// Converts known Mongoose/JS errors into AppError so the response shape is
// always consistent, whatever failed.
function normalizeError(err) {
  if (err instanceof AppError) return err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    const appErr = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    appErr.details = details;
    return appErr;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(', ');
    return new AppError(`Duplicate value for field(s): ${field}`, 409, 'DUPLICATE_KEY');
  }

  // Invalid ObjectId cast
  if (err.name === 'CastError') {
    return new AppError(`Invalid value for ${err.path}`, 400, 'INVALID_ID');
  }

  // JWT errors (defensive - auth.js already handles the common path)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
  }

  // Unknown/unexpected error - never leak internals to the client.
  const appErr = new AppError('Something went wrong on the server', 500, 'INTERNAL_ERROR');
  appErr.original = err;
  return appErr;
}

// Express requires exactly 4 args for this to be recognized as error middleware.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  if (normalized.statusCode >= 500) {
    console.error('[error]', normalized.original || normalized);
  }

  const body = {
    success: false,
    message: normalized.message,
    errorCode: normalized.errorCode,
  };
  if (normalized.details) body.details = normalized.details;

  res.status(normalized.statusCode).json(body);
}

// 404 handler for unmatched routes.
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

module.exports = { errorHandler, notFound };
