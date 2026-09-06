const { body, param, query } = require('express-validator');

const upsertValidators = [
  body('storeId').isMongoId().withMessage('storeId must be a valid id'),
  body('productId').isMongoId().withMessage('productId must be a valid id'),
  body('quantity').isInt({ min: 0 }).withMessage('quantity must be a non-negative integer'),
  body('reorderPoint').optional().isInt({ min: 0 }).withMessage('reorderPoint must be a non-negative integer'),
];

const adjustValidators = [
  param('id').isMongoId(),
  body('delta').isInt().withMessage('delta must be an integer (positive to add stock, negative to deduct)'),
];

const listByStoreValidators = [param('storeId').isMongoId().withMessage('Invalid storeId')];

const lowStockQueryValidators = [query('storeId').optional().isMongoId()];

module.exports = { upsertValidators, adjustValidators, listByStoreValidators, lowStockQueryValidators };
