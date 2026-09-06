const { body, param, query } = require('express-validator');
const { ORDER_STATUSES } = require('../../utils/orderStateMachine');

const placeOrderValidators = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isMongoId().withMessage('Each item needs a valid productId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item quantity must be >= 1'),
  body('deliveryAddress.line1').trim().notEmpty().withMessage('deliveryAddress.line1 is required'),
  body('deliveryAddress.area').trim().notEmpty().withMessage('deliveryAddress.area is required'),
  body('deliveryAddress.pincode').trim().notEmpty().withMessage('deliveryAddress.pincode is required'),
  body('deliveryAddress.location.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('deliveryAddress.location.coordinates must be [longitude, latitude]'),
  body('deliveryAddress.location.coordinates.*')
    .optional()
    .isFloat()
    .withMessage('deliveryAddress.location.coordinates must contain numbers'),
  body('deliverySlot').optional().custom((slot) => {
    const fields = [slot.date, slot.startTime, slot.endTime];
    if (fields.some((field) => field === undefined || field === '')) {
      throw new Error('deliverySlot.date, startTime, and endTime are required together');
    }
    if (!/^\d{2}:\d{2}$/.test(slot.startTime) || !/^\d{2}:\d{2}$/.test(slot.endTime)) {
      throw new Error('deliverySlot times must be HH:mm');
    }
    const [startHour, startMinute] = slot.startTime.split(':').map(Number);
    const [endHour, endMinute] = slot.endTime.split(':').map(Number);
    if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) {
      throw new Error('deliverySlot times must be valid');
    }
    if (startHour * 60 + startMinute >= endHour * 60 + endMinute) {
      throw new Error('deliverySlot.startTime must be before endTime');
    }
    const date = new Date(slot.date);
    if (Number.isNaN(date.getTime())) throw new Error('deliverySlot.date must be a valid date');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) throw new Error('deliverySlot.date must be today or later');
    return true;
  }),
];

const statusUpdateValidators = [
  param('id').isMongoId(),
  body('status')
    .isIn(Object.values(ORDER_STATUSES))
    .withMessage(`status must be one of ${Object.values(ORDER_STATUSES).join(', ')}`),
  body('remarks').optional().trim().isLength({ max: 500 }),
];

const assignValidators = [
  param('id').isMongoId(),
  body('deliveryPartnerId').optional().isMongoId().withMessage('deliveryPartnerId must be a valid id'),
];

const idParamValidator = [param('id').isMongoId().withMessage('Invalid id')];

const listQueryValidators = [
  query('status').optional().isIn(Object.values(ORDER_STATUSES)),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  placeOrderValidators,
  statusUpdateValidators,
  assignValidators,
  idParamValidator,
  listQueryValidators,
};
