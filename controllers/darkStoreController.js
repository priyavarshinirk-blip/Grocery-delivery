const DarkStore = require('../models/DarkStore');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

// POST /api/dark-stores (admin only)
const createStore = catchAsync(async (req, res, next) => {
  const { name, area, location, serviceablePincodes } = req.body;
  const existing = await DarkStore.findOne({ name });
  if (existing) return next(new AppError('A dark store with this name already exists', 409, 'DUPLICATE_KEY'));

  const store = await DarkStore.create({ name, area, location, serviceablePincodes });
  return sendSuccess(res, 201, 'Dark store created successfully', { store });
});

// GET /api/dark-stores
const listStores = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  const stores = await DarkStore.find(filter).sort({ name: 1 });
  return sendSuccess(res, 200, 'Dark stores fetched', { stores });
});

// GET /api/dark-stores/:id
const getStore = catchAsync(async (req, res, next) => {
  const store = await DarkStore.findById(req.params.id);
  if (!store) return next(new AppError('Dark store not found', 404, 'NOT_FOUND'));
  return sendSuccess(res, 200, 'Dark store fetched', { store });
});

// PUT /api/dark-stores/:id (admin only)
const updateStore = catchAsync(async (req, res, next) => {
  const store = await DarkStore.findById(req.params.id);
  if (!store) return next(new AppError('Dark store not found', 404, 'NOT_FOUND'));

  const allowed = ['name', 'area', 'location', 'serviceablePincodes', 'isActive'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) store[field] = req.body[field];
  });
  await store.save();
  return sendSuccess(res, 200, 'Dark store updated successfully', { store });
});

// DELETE /api/dark-stores/:id (admin only) - soft delete to preserve order history integrity
const deactivateStore = catchAsync(async (req, res, next) => {
  const store = await DarkStore.findById(req.params.id);
  if (!store) return next(new AppError('Dark store not found', 404, 'NOT_FOUND'));
  store.isActive = false;
  await store.save();
  return sendSuccess(res, 200, 'Dark store deactivated successfully', { store });
});

module.exports = { createStore, listStores, getStore, updateStore, deactivateStore };
