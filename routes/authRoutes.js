const express = require('express');
const { register, login, getMe, updateMe, createAdmin } = require('../controllers/authController');
const { registerValidators, loginValidators, updateMeValidators, createAdminValidators } = require('../middleware/validators/authValidators');
const validate = require('../middleware/validate');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerValidators, validate, register);
router.post('/login', loginValidators, validate, login);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMeValidators, validate, updateMe);
router.post('/create-admin', protect, restrictTo('admin'), createAdminValidators, validate, createAdmin);

module.exports = router;
