// Wraps an async route handler so any thrown error / rejected promise is
// forwarded to Express's error-handling middleware instead of crashing the
// process with an unhandled rejection.
module.exports = function catchAsync(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
