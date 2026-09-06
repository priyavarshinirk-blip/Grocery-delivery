const { query } = require('express-validator');

const performanceQueryValidators = [
  query('storeId').optional().isMongoId(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];

module.exports = { performanceQueryValidators };
