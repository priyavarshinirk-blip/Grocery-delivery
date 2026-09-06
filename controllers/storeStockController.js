const StoreStock = require('../models/StoreStock');
const DarkStore = require('../models/DarkStore');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

function assertStoreScope(user, storeId) {
  if (user.role === 'store_staff' && (!user.assignedStore || user.assignedStore.toString() !== storeId.toString())) {
    throw new AppError('You can only access stock for your assigned store', 403, 'FORBIDDEN');
  }
}

// POST /api/store-stock (admin only) - create or overwrite a store's stock record for a product
const upsertStock = catchAsync(async (req, res, next) => {
  const { storeId, productId, quantity, reorderPoint } = req.body;

  const [store, product] = await Promise.all([DarkStore.findById(storeId), Product.findById(productId)]);
  if (!store) return next(new AppError('storeId does not reference a valid dark store', 400, 'VALIDATION_ERROR'));
  if (!product) return next(new AppError('productId does not reference a valid product', 400, 'VALIDATION_ERROR'));

  const update = { quantity };
  if (reorderPoint !== undefined) update.reorderPoint = reorderPoint;

  const stock = await StoreStock.findOneAndUpdate(
    { storeId, productId },
    { $set: update, $setOnInsert: { storeId, productId } },
    { upsert: true, new: true, runValidators: true }
  );
  return sendSuccess(res, 201, 'Store stock upserted successfully', { stock });
});

// GET /api/store-stock/store/:storeId - browse products with stock at a given store (module 3)
const listByStore = catchAsync(async (req, res, next) => {
  assertStoreScope(req.user, req.params.storeId);
  const store = await DarkStore.findById(req.params.storeId);
  if (!store) return next(new AppError('Dark store not found', 404, 'NOT_FOUND'));

  const stock = await StoreStock.find({ storeId: req.params.storeId })
    .populate('productId', 'name category price unit isActive')
    .sort({ 'productId.name': 1 });

  return sendSuccess(res, 200, 'Store stock fetched', { store: { id: store._id, name: store.name }, stock });
});

// PATCH /api/store-stock/:id/adjust (store_staff, admin) - relative adjustment, used during pick/pack
// deduction and restocking. Rejects operations that would push quantity negative.
const adjustStock = catchAsync(async (req, res, next) => {
  const { delta } = req.body;
  const stock = await StoreStock.findById(req.params.id);
  if (!stock) return next(new AppError('Store stock record not found', 404, 'NOT_FOUND'));
  assertStoreScope(req.user, stock.storeId);

  const newQuantity = stock.quantity + delta;
  if (newQuantity < 0) {
    return next(new AppError('Adjustment would result in negative stock', 409, 'INSUFFICIENT_STOCK'));
  }

  stock.quantity = newQuantity;
  await stock.save();
  return sendSuccess(res, 200, 'Stock adjusted successfully', { stock });
});

// GET /api/store-stock/low-stock?storeId= (module 9: replenishment alerts)
const lowStockAlerts = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.storeId) filter.storeId = req.query.storeId;
  if (req.user.role === 'store_staff') {
    if (!req.user.assignedStore) return next(new AppError('This staff account has no assigned store', 400, 'NO_ASSIGNED_STORE'));
    if (req.query.storeId && req.query.storeId !== req.user.assignedStore.toString()) {
      return next(new AppError('You can only access stock for your assigned store', 403, 'FORBIDDEN'));
    }
    filter.storeId = req.user.assignedStore;
  }

  const lowStock = await StoreStock.aggregate([
    { $match: filter },
    { $match: { $expr: { $lte: ['$quantity', '$reorderPoint'] } } },
    {
      $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' },
    },
    { $unwind: '$product' },
    {
      $lookup: { from: 'darkstores', localField: 'storeId', foreignField: '_id', as: 'store' },
    },
    { $unwind: '$store' },
    {
      $project: {
        storeId: 1,
        storeName: '$store.name',
        productId: 1,
        productName: '$product.name',
        quantity: 1,
        reorderPoint: 1,
      },
    },
    { $sort: { storeName: 1, productName: 1 } },
  ]);

  return sendSuccess(res, 200, 'Low-stock alerts fetched', { count: lowStock.length, alerts: lowStock });
});

module.exports = { upsertStock, listByStore, adjustStock, lowStockAlerts };
