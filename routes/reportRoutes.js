const express = require('express');
const ctrl = require('../controllers/reportController');
const { performanceQueryValidators } = require('../middleware/validators/reportValidators');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.get('/performance', protect, restrictTo('admin', 'store_staff'), performanceQueryValidators, validate, ctrl.performanceReport);

module.exports = router;
