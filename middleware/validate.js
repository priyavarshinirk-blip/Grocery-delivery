const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Runs after an array of express-validator checks; if any failed, returns a
// clean 400 instead of letting bad data reach the controller/business logic.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    const err = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    err.details = details;
    return next(err);
  }
  next();
}

module.exports = validate;
