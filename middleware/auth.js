const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');

// Verifies the Bearer token and attaches the authenticated user (minus
// passwordHash) to req.user. Every protected route uses this first.
const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication token missing', 401, 'UNAUTHORIZED'));
  }

  const token = header.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401, 'UNAUTHORIZED'));
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) {
    return next(new AppError('User no longer exists or is inactive', 401, 'UNAUTHORIZED'));
  }

  req.user = user;
  next();
});

// Restricts a route to a set of roles. Must run after protect().
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
    }
    next();
  };
}

module.exports = { protect, restrictTo };
