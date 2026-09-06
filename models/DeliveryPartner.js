const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    isAvailable: { type: Boolean, default: true },
    // Denormalized pointer to the order currently being carried, so
    // "available partners" queries don't need a $lookup into orders.
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    vehicleType: { type: String, enum: ['bike', 'bicycle', 'scooter', 'van'], default: 'bike' },
  },
  { timestamps: true }
);

deliveryPartnerSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
