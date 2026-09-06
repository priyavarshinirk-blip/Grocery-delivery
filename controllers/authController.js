const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DarkStore = require('../models/DarkStore');
const DeliveryPartner = require('../models/DeliveryPartner');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitizeUser(user) {
  const obj = user.toObject();
  delete obj.passwordHash;
  return obj;
}

// POST /api/auth/register
const register = catchAsync(async (req, res, next) => {
  const { name, email, password, role = 'customer', phone, assignedStore, defaultAddress } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return next(new AppError('An account with this email already exists', 409, 'DUPLICATE_KEY'));
  }

  if (role === 'store_staff') {
    const store = await DarkStore.findById(assignedStore);
    if (!store) return next(new AppError('assignedStore does not reference a valid dark store', 400, 'VALIDATION_ERROR'));
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    phone,
    assignedStore: role === 'store_staff' ? assignedStore : undefined,
    defaultAddress: role === 'customer' ? defaultAddress : undefined,
  });

  if (role === 'delivery_partner') {
    await DeliveryPartner.create({ userId: user._id });
  }

  const token = signToken(user);
  return sendSuccess(res, 201, 'Account created successfully', { user: sanitizeUser(user), token });
});

// POST /api/auth/login
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid email or password', 401, 'UNAUTHORIZED'));
  }
  if (!user.isActive) {
    return next(new AppError('This account has been deactivated', 403, 'FORBIDDEN'));
  }

  const token = signToken(user);
  return sendSuccess(res, 200, 'Login successful', { user: sanitizeUser(user), token });
});

// GET /api/auth/me
const getMe = catchAsync(async (req, res) => {
  return sendSuccess(res, 200, 'Current user fetched', { user: sanitizeUser(req.user) });
});

// PATCH /api/auth/me
const updateMe = catchAsync(async (req, res, next) => {
  if (req.body.name !== undefined) req.user.name = req.body.name;
  if (req.body.email !== undefined && req.body.email !== req.user.email) {
    const existing = await User.findOne({ email: req.body.email, _id: { $ne: req.user._id } });
    if (existing) return next(new AppError('An account with this email already exists', 409, 'DUPLICATE_KEY'));
    req.user.email = req.body.email;
  }
  if (req.body.phone !== undefined) req.user.phone = req.body.phone;
  if (req.body.defaultAddress !== undefined) {
    req.user.defaultAddress = {
      ...(req.user.defaultAddress?.toObject?.() || req.user.defaultAddress || {}),
      ...req.body.defaultAddress,
    };
  }
  await req.user.save();
  return sendSuccess(res, 200, 'Profile updated successfully', { user: sanitizeUser(req.user) });
});

// POST /api/auth/create-admin (admin-only, for provisioning further admins)
const createAdmin = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return next(new AppError('An account with this email already exists', 409, 'DUPLICATE_KEY'));

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: 'admin' });
  return sendSuccess(res, 201, 'Admin account created successfully', { user: sanitizeUser(user) });
});

module.exports = { register, login, getMe, updateMe, createAdmin };
