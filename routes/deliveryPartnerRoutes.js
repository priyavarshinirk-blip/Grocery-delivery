const express = require('express');
const ctrl = require('../controllers/deliveryPartnerController');
const { availabilityValidators, listQueryValidators } = require('../middleware/validators/deliveryPartnerValidators');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, restrictTo('admin', 'store_staff'), listQueryValidators, validate, ctrl.listPartners);
router.get('/me', protect, restrictTo('delivery_partner'), ctrl.getMyProfile);
router.patch('/me/availability', protect, restrictTo('delivery_partner'), availabilityValidators, validate, ctrl.setAvailability);

module.exports = router;
