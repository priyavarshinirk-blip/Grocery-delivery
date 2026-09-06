const express = require('express');
const ctrl = require('../controllers/orderController');
const {
  placeOrderValidators,
  statusUpdateValidators,
  assignValidators,
  idParamValidator,
  listQueryValidators,
} = require('../middleware/validators/orderValidators');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, restrictTo('customer'), placeOrderValidators, validate, ctrl.placeOrder);
router.get('/', protect, listQueryValidators, validate, ctrl.listOrders);
router.get('/:id', protect, idParamValidator, validate, ctrl.getOrder);
router.put('/:id/status', protect, statusUpdateValidators, validate, ctrl.updateStatus);
router.put('/:id/assign', protect, restrictTo('admin', 'store_staff'), assignValidators, validate, ctrl.assignDeliveryPartner);
router.post('/:id/reorder', protect, restrictTo('customer'), idParamValidator, validate, ctrl.reorder);

module.exports = router;
