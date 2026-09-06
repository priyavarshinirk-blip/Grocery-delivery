const mongoose = require('mongoose');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const { ORDER_STATUSES } = require('../utils/orderStateMachine');

function statusTimestamp(order, status) {
  const entry = order.statusHistory.find((h) => h.status === status);
  return entry ? entry.at : null;
}

function avg(numbers) {
  if (numbers.length === 0) return null;
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

// GET /api/reports/performance?storeId=&from=&to=
// store_staff is always scoped to their own store; admin may query any store
// or omit storeId to get a breakdown across all stores.
const performanceReport = catchAsync(async (req, res, next) => {
  const match = {};

  if (req.user.role === 'store_staff') {
    if (!req.user.assignedStore) return next(new AppError('This staff account has no assigned store', 400, 'NO_ASSIGNED_STORE'));
    match.storeId = req.user.assignedStore;
  } else if (req.query.storeId) {
    match.storeId = new mongoose.Types.ObjectId(req.query.storeId);
  }

  if (req.query.from || req.query.to) {
    match.createdAt = {};
    if (req.query.from) match.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) match.createdAt.$lte = new Date(req.query.to);
  }

  // Order volume + status breakdown, grouped by store - this aggregation is
  // the appropriate use of $group/$lookup (a reporting query), not a
  // per-request join used to fake a relational read.
  const volumeByStore = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$storeId',
        totalOrders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUSES.DELIVERED] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUSES.FAILED] }, 1, 0] } },
        inProgress: {
          $sum: {
            $cond: [{ $in: ['$status', [ORDER_STATUSES.PLACED, ORDER_STATUSES.PICKING, ORDER_STATUSES.PACKED, ORDER_STATUSES.ASSIGNED, ORDER_STATUSES.OUT_FOR_DELIVERY]] }, 1, 0],
          },
        },
        totalRevenue: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUSES.DELIVERED] }, '$totalAmount', 0] } },
      },
    },
    {
      $lookup: { from: 'darkstores', localField: '_id', foreignField: '_id', as: 'store' },
    },
    { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        storeId: '$_id',
        storeName: '$store.name',
        totalOrders: 1,
        delivered: 1,
        failed: 1,
        inProgress: 1,
        totalRevenue: 1,
      },
    },
    { $sort: { storeName: 1 } },
  ]);

  // Timing metrics (avg pick time, avg pack time, avg total delivery time)
  // are derived from the embedded statusHistory - this is exactly why that
  // log is embedded on the order rather than kept in a separate collection.
  const timedOrders = await Order.find({ ...match, status: { $in: [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.FAILED] } }).select(
    'storeId statusHistory status'
  );

  const byStoreTiming = new Map();
  for (const order of timedOrders) {
    const key = order.storeId.toString();
    if (!byStoreTiming.has(key)) byStoreTiming.set(key, { pickTimes: [], packTimes: [], deliveryTimes: [] });
    const bucket = byStoreTiming.get(key);

    const placedAt = statusTimestamp(order, ORDER_STATUSES.PLACED);
    const pickingAt = statusTimestamp(order, ORDER_STATUSES.PICKING);
    const packedAt = statusTimestamp(order, ORDER_STATUSES.PACKED);
    const deliveredAt = statusTimestamp(order, ORDER_STATUSES.DELIVERED);

    if (placedAt && pickingAt) bucket.pickTimes.push(pickingAt - placedAt);
    if (pickingAt && packedAt) bucket.packTimes.push(packedAt - pickingAt);
    if (placedAt && deliveredAt) bucket.deliveryTimes.push(deliveredAt - placedAt);
  }

  const report = volumeByStore.map((row) => {
    const timing = byStoreTiming.get(row.storeId.toString()) || { pickTimes: [], packTimes: [], deliveryTimes: [] };
    return {
      ...row,
      avgPickTimeMs: avg(timing.pickTimes),
      avgPackTimeMs: avg(timing.packTimes),
      avgDeliveryTimeMs: avg(timing.deliveryTimes),
    };
  });

  return sendSuccess(res, 200, 'Performance report generated', { report });
});

module.exports = { performanceReport };
