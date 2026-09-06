const { body, param } = require('express-validator');

const createValidators = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('area').trim().notEmpty().withMessage('area is required'),
  body('location.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('location.coordinates must be [lng, lat]'),
  body('location.coordinates.*').isFloat().withMessage('coordinates must be numbers'),
  body('serviceablePincodes').optional().isArray().withMessage('serviceablePincodes must be an array'),
];

const updateValidators = [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  body('area').optional().trim().notEmpty(),
  body('location.coordinates').optional().isArray({ min: 2, max: 2 }),
  body('serviceablePincodes').optional().isArray(),
  body('isActive').optional().isBoolean(),
];

const idParamValidator = [param('id').isMongoId().withMessage('Invalid id')];

module.exports = { createValidators, updateValidators, idParamValidator };
