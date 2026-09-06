const mongoose = require('mongoose');

// storeStock references both DarkStore and Product rather than embedding,
// because stock quantity is updated independently and very frequently
// (every order), and the same product is shared across many stores.
const storeStockSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'DarkStore', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    reorderPoint: {
      type: Number,
      required: true,
      min: 0,
      default: () => Number(process.env.DEFAULT_REORDER_POINT) || 10,
    },
  },
  { timestamps: true }
);

// A given product can only have one stock record per store.
storeStockSchema.index({ storeId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('StoreStock', storeStockSchema);
