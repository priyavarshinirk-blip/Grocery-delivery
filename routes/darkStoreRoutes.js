const express = require('express');
const ctrl = require('../controllers/darkStoreController');
const { createValidators, updateValidators, idParamValidator } = require('../middleware/validators/darkStoreValidators');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, ctrl.listStores); // any authenticated role can browse stores
router.get('/:id', protect, idParamValidator, validate, ctrl.getStore);
router.post('/', protect, restrictTo('admin'), createValidators, validate, ctrl.createStore);
router.put('/:id', protect, restrictTo('admin'), updateValidators, validate, ctrl.updateStore);
router.delete('/:id', protect, restrictTo('admin'), idParamValidator, validate, ctrl.deactivateStore);

module.exports = router;
