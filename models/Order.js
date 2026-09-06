const mongoose = require('mongoose');
const { ORDER_STATUSES } = require('../utils/orderStateMachine');

// Line items are embedded: they are always read together with the order,
// never queried independently, and must freeze the product name/price at
// order time (product price can change later without altering past orders).
const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // price snapshot at order time
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

// Embedded status-change log used directly by the performance-report
// aggregation (avg pick time, avg delivery time) without a separate
// collection or $lookup.
const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUSES), required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DarkStore', required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    status: { type: String, enum: Object.values(ORDER_STATUSES), default: ORDER_STATUSES.PLACED },
    statusHistory: { type: [statusHistorySchema], default: [] },

    deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: null },

    // Snapshot of where to deliver, embedded because it must not change if
    // the customer later edits their profile address.
    deliveryAddress: {
      line1: { type: String, required: true },
      area: { type: String, required: true },
      pincode: { type: String, required: true },
    },

    // Module 10: optional customer-chosen delivery window.
    deliverySlot: {
      date: { type: Date },
      startTime: { type: String }, // 'HH:mm'
      endTime: { type: String },
    },

    failureReason: { type: String, trim: true },
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, status: 1 });
orderSchema.index({ deliveryPartnerId: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
