const express = require('express');
const ctrl = require('../controllers/productController');
const { createValidators, updateValidators, idParamValidator } = require('../middleware/validators/productValidators');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, ctrl.listProducts);
router.get('/:id', protect, idParamValidator, validate, ctrl.getProduct);
router.post('/', protect, restrictTo('admin'), createValidators, validate, ctrl.createProduct);
router.put('/:id', protect, restrictTo('admin'), updateValidators, validate, ctrl.updateProduct);
router.delete('/:id', protect, restrictTo('admin'), idParamValidator, validate, ctrl.deactivateProduct);

module.exports = router;
