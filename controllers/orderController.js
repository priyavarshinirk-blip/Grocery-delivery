const Order = require('../models/Order');
const Product = require('../models/Product');
const StoreStock = require('../models/StoreStock');
const DeliveryPartner = require('../models/DeliveryPartner');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const { findNearestServiceableStore } = require('../utils/nearestStore');
const { ORDER_STATUSES, canTransition, isRoleAllowed, isTerminal } = require('../utils/orderStateMachine');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Deducts stock for each line item at the resolved store. Since a single
// standalone MongoDB instance (no replica set) cannot guarantee multi-document
// ACID transactions, this uses atomic conditional updates (quantity: {$gte: qty})
// per item and compensates (rolls back) any deductions already applied if a
// later item in the same order turns out to be insufficient. This keeps stock
// consistent even under concurrent order placement without requiring a
// replica-set-only feature.
async function deductStockOrThrow(storeId, items) {
  const applied = [];
  for (const item of items) {
    const result = await StoreStock.findOneAndUpdate(
      { storeId, productId: item.productId, quantity: { $gte: item.quantity } },
      { $inc: { quantity: -item.quantity } },
      { new: true }
    );
    if (!result) {
      // Roll back everything already deducted in this order.
      for (const done of applied) {
        await StoreStock.updateOne(
          { storeId, productId: done.productId },
          { $inc: { quantity: done.quantity } }
        );
      }
      throw new AppError(
        `Insufficient stock for one or more items at the selected store`,
        409,
        'INSUFFICIENT_STOCK'
      );
    }
    applied.push(item);
  }
}

async function restoreStock(storeId, items) {
  for (const item of items) {
    await StoreStock.updateOne(
      { storeId, productId: item.productId },
      { $inc: { quantity: item.quantity } }
    );
  }
}

// Ownership/visibility check - who is allowed to read/act on this order.
function assertOrderAccess(order, user, deliveryPartnerDoc) {
  if (user.role === 'admin') return;
  if (user.role === 'customer' && order.customerId.equals(user._id)) return;
  if (user.role === 'store_staff' && user.assignedStore && order.storeId.equals(user.assignedStore)) return;
  if (
    user.role === 'delivery_partner' &&
    order.deliveryPartnerId &&
    deliveryPartnerDoc &&
    order.deliveryPartnerId.equals(deliveryPartnerDoc._id)
  ) {
    return;
  }
  throw new AppError('You do not have permission to access this order', 403, 'FORBIDDEN');
}

// ---------------------------------------------------------------------------
// POST /api/orders (customer) - module 4: order placement with nearest-store check
// ---------------------------------------------------------------------------
const placeOrder = catchAsync(async (req, res, next) => {
  const { items, deliveryAddress, deliverySlot } = req.body;

  const store = await findNearestServiceableStore(deliveryAddress); // throws 409 if none serviceable

  // Resolve products and freeze name/price at order time.
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const missing = productIds.filter((id) => !productMap.has(id.toString()));
  if (missing.length > 0) {
    return next(new AppError(`One or more products are invalid or unavailable: ${missing.join(', ')}`, 400, 'VALIDATION_ERROR'));
  }

  const orderItems = items.map((i) => {
    const product = productMap.get(i.productId.toString());
    return { productId: product._id, name: product.name, price: product.price, quantity: i.quantity };
  });
  const totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Business rule: stock must be validated (and reserved) at the resolved
  // nearest store before the order is confirmed - never accept an order the
  // store cannot actually fulfil.
  await deductStockOrThrow(store._id, orderItems);

  let order;
  try {
    order = await Order.create({
      customerId: req.user._id,
      storeId: store._id,
      items: orderItems,
      totalAmount,
      status: ORDER_STATUSES.PLACED,
      statusHistory: [{ status: ORDER_STATUSES.PLACED, at: new Date(), by: req.user._id }],
      deliveryAddress,
      deliverySlot,
    });
  } catch (err) {
    await restoreStock(store._id, orderItems);
    throw err;
  }

  return sendSuccess(res, 201, 'Order placed successfully', { order, resolvedStore: { id: store._id, name: store.name } });
});

// ---------------------------------------------------------------------------
// GET /api/orders - role-scoped listing (module 11: customer history; also used
// by store staff / delivery partners / admin as their respective queues)
// ---------------------------------------------------------------------------
const listOrders = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  if (req.user.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.user.role === 'store_staff') {
    if (!req.user.assignedStore) return next(new AppError('This staff account has no assigned store', 400, 'NO_ASSIGNED_STORE'));
    filter.storeId = req.user.assignedStore;
  } else if (req.user.role === 'delivery_partner') {
    const dp = await DeliveryPartner.findOne({ userId: req.user._id });
    if (!dp) return next(new AppError('Delivery partner profile not found', 404, 'NOT_FOUND'));
    filter.deliveryPartnerId = dp._id;
  }
  // admin: no filter beyond optional status -> sees everything

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, 'Orders fetched', {
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id - module 8: real-time order status for customer (and
// the equivalent detail view for staff/delivery/admin)
// ---------------------------------------------------------------------------
const getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404, 'NOT_FOUND'));

  let dp = null;
  if (req.user.role === 'delivery_partner') {
    dp = await DeliveryPartner.findOne({ userId: req.user._id });
  }
  assertOrderAccess(order, req.user, dp);

  return sendSuccess(res, 200, 'Order fetched', { order });
});

// ---------------------------------------------------------------------------
// PUT /api/orders/:id/status - generic guarded transition endpoint.
// Handles PLACED->PICKING, PICKING->PACKED, ASSIGNED->OUT_FOR_DELIVERY,
// OUT_FOR_DELIVERY->DELIVERED, and any ->FAILED. Assignment (PACKED->ASSIGNED)
// is intentionally NOT accepted here - it must go through /assign, which
// also stores which delivery partner picked up the order.
// modules 5, 7 ---------------------------------------------------------------
const updateStatus = catchAsync(async (req, res, next) => {
  const { status: nextStatus, remarks } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404, 'NOT_FOUND'));

  if (nextStatus === ORDER_STATUSES.ASSIGNED) {
    return next(new AppError('Use PUT /api/orders/:id/assign to move an order to ASSIGNED', 400, 'USE_ASSIGN_ENDPOINT'));
  }

  let dp = null;
  if (req.user.role === 'delivery_partner') {
    dp = await DeliveryPartner.findOne({ userId: req.user._id });
  }
  assertOrderAccess(order, req.user, dp);

  if (isTerminal(order.status)) {
    return next(new AppError(`Order is already in a terminal state (${order.status}) and cannot be updated`, 409, 'INVALID_TRANSITION'));
  }
  if (!canTransition(order.status, nextStatus)) {
    return next(
      new AppError(`Cannot transition order from ${order.status} to ${nextStatus}`, 409, 'INVALID_TRANSITION')
    );
  }
  if (!isRoleAllowed(order.status, nextStatus, req.user.role)) {
    return next(new AppError(`Role '${req.user.role}' is not permitted to perform this transition`, 403, 'FORBIDDEN'));
  }

  order.status = nextStatus;
  order.statusHistory.push({ status: nextStatus, at: new Date(), by: req.user._id });
  if (nextStatus === ORDER_STATUSES.FAILED && remarks) order.failureReason = remarks;

  // Business rule: if an order fails before delivery, restore the stock that
  // was reserved for it so it becomes sellable again.
  if (nextStatus === ORDER_STATUSES.FAILED) {
    await restoreStock(order.storeId, order.items);
  }

  // Free up the delivery partner once the order reaches a terminal state.
  if ((nextStatus === ORDER_STATUSES.DELIVERED || nextStatus === ORDER_STATUSES.FAILED) && order.deliveryPartnerId) {
    await DeliveryPartner.updateOne(
      { _id: order.deliveryPartnerId, currentOrder: order._id },
      { $set: { isAvailable: true, currentOrder: null } }
    );
  }

  await order.save();
  return sendSuccess(res, 200, 'Order status updated successfully', { status: order.status });
});

// ---------------------------------------------------------------------------
// PUT /api/orders/:id/assign - module 6: delivery partner assignment
// (store_staff or admin). If deliveryPartnerId is omitted, auto-assigns the
// first available partner.
// ---------------------------------------------------------------------------
const assignDeliveryPartner = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404, 'NOT_FOUND'));

  if (req.user.role === 'store_staff' && (!req.user.assignedStore || !order.storeId.equals(req.user.assignedStore))) {
    return next(new AppError('You can only assign orders belonging to your own store', 403, 'FORBIDDEN'));
  }

  if (!canTransition(order.status, ORDER_STATUSES.ASSIGNED)) {
    return next(new AppError(`Cannot assign a delivery partner while order is in status ${order.status}`, 409, 'INVALID_TRANSITION'));
  }

  let partner;
  if (req.body.deliveryPartnerId) {
    partner = await DeliveryPartner.findById(req.body.deliveryPartnerId);
    if (!partner) return next(new AppError('deliveryPartnerId does not reference a valid delivery partner', 400, 'VALIDATION_ERROR'));
    if (!partner.isAvailable) return next(new AppError('Selected delivery partner is not available', 409, 'PARTNER_UNAVAILABLE'));
  } else {
    partner = await DeliveryPartner.findOne({ isAvailable: true });
    if (!partner) return next(new AppError('No delivery partners are currently available', 409, 'NO_PARTNER_AVAILABLE'));
  }

  const claimed = await DeliveryPartner.findOneAndUpdate(
    { _id: partner._id, isAvailable: true, currentOrder: null },
    { $set: { isAvailable: false, currentOrder: order._id } },
    { new: true }
  );
  if (!claimed) return next(new AppError('Selected delivery partner is no longer available', 409, 'PARTNER_UNAVAILABLE'));

  order.status = ORDER_STATUSES.ASSIGNED;
  order.deliveryPartnerId = partner._id;
  order.statusHistory.push({ status: ORDER_STATUSES.ASSIGNED, at: new Date(), by: req.user._id });
  try {
    await order.save();
  } catch (err) {
    await DeliveryPartner.updateOne({ _id: claimed._id, currentOrder: order._id }, { $set: { isAvailable: true, currentOrder: null } });
    throw err;
  }

  return sendSuccess(res, 200, 'Delivery partner assigned successfully', { status: order.status, deliveryPartnerId: partner._id });
});

// ---------------------------------------------------------------------------
// POST /api/orders/:id/reorder - module 11: reorder from history
// ---------------------------------------------------------------------------
const reorder = catchAsync(async (req, res, next) => {
  const original = await Order.findById(req.params.id);
  if (!original) return next(new AppError('Order not found', 404, 'NOT_FOUND'));
  if (!original.customerId.equals(req.user._id)) {
    return next(new AppError('You can only reorder your own past orders', 403, 'FORBIDDEN'));
  }

  // Re-run through the same placement logic so stock/store are re-validated
  // against current availability rather than blindly cloning stale state.
  const items = original.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  req.body = { items, deliveryAddress: original.deliveryAddress, deliverySlot: undefined };
  return placeOrder(req, res, next);
});

module.exports = { placeOrder, listOrders, getOrder, updateStatus, assignDeliveryPartner, reorder };
