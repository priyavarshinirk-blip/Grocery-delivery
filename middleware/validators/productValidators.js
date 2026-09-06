const { body, param } = require('express-validator');

const createValidators = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('category').trim().notEmpty().withMessage('category is required'),
  body('price').isFloat({ min: 0 }).withMessage('price must be a non-negative number'),
  body('unit').optional().trim().notEmpty(),
  body('description').optional().trim(),
];

const updateValidators = [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  body('category').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('unit').optional().trim().notEmpty(),
  body('isActive').optional().isBoolean(),
];

const idParamValidator = [param('id').isMongoId().withMessage('Invalid id')];

module.exports = { createValidators, updateValidators, idParamValidator };
