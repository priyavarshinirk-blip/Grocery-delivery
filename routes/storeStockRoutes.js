const express = require('express');
const ctrl = require('../controllers/storeStockController');
const {
  upsertValidators,
  adjustValidators,
  listByStoreValidators,
  lowStockQueryValidators,
} = require('../middleware/validators/storeStockValidators');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.get('/low-stock', protect, restrictTo('admin', 'store_staff'), lowStockQueryValidators, validate, ctrl.lowStockAlerts);
router.get('/store/:storeId', protect, listByStoreValidators, validate, ctrl.listByStore);
router.post('/', protect, restrictTo('admin'), upsertValidators, validate, ctrl.upsertStock);
router.patch('/:id/adjust', protect, restrictTo('admin', 'store_staff'), adjustValidators, validate, ctrl.adjustStock);

module.exports = router;
