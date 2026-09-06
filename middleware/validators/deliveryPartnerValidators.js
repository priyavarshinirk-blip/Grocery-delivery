const { body, query } = require('express-validator');

const availabilityValidators = [body('isAvailable').isBoolean().withMessage('isAvailable must be true or false')];

const listQueryValidators = [query('isAvailable').optional().isBoolean()];

module.exports = { availabilityValidators, listQueryValidators };
