const mongoose = require('mongoose');

const darkStoreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    area: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    // Pincodes this store can deliver to. Kept as a simple embedded array
    // since it's small and always read with the store document.
    serviceablePincodes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

darkStoreSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DarkStore', darkStoreSchema);
