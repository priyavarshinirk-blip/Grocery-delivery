const { body } = require('express-validator');
const { ROLES } = require('../../models/User');

// Public registration only allows customer/store_staff/delivery_partner.
// 'admin' accounts must be created by an existing admin via a protected
// route, never through open self-registration.
const registerValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['customer', 'store_staff', 'delivery_partner'])
    .withMessage('role must be one of customer, store_staff, delivery_partner'),
  body('phone').optional().trim().isLength({ min: 7, max: 15 }),
  body('assignedStore')
    .if(body('role').equals('store_staff'))
    .notEmpty()
    .withMessage('assignedStore is required for store_staff registration')
    .isMongoId()
    .withMessage('assignedStore must be a valid dark store id'),
];

const loginValidators = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const updateMeValidators = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional().trim().isLength({ min: 7, max: 15 }).withMessage('Phone must be 7-15 characters'),
  body('defaultAddress.line1').optional().trim().notEmpty().withMessage('Address line is required'),
  body('defaultAddress.area').optional().trim().notEmpty().withMessage('Area is required'),
  body('defaultAddress.pincode').optional().trim().notEmpty().withMessage('Pincode is required'),
];

const createAdminValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
];

module.exports = { registerValidators, loginValidators, updateMeValidators, createAdminValidators, ROLES };
