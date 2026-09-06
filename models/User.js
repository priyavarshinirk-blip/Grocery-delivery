const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['customer', 'store_staff', 'delivery_partner', 'admin'];

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    area: { type: String, trim: true },
    pincode: { type: String, trim: true },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'customer' },
    phone: { type: String, trim: true },

    // Only meaningful for role === 'customer'. Embedded because it is small,
    // always read together with the user, and rarely changes independently.
    defaultAddress: { type: addressSchema, default: undefined },

    // Only meaningful for role === 'store_staff'. Referenced (not embedded)
    // because a dark store is a shared, independently-updated entity.
    assignedStore: { type: mongoose.Schema.Types.ObjectId, ref: 'DarkStore' },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ 'defaultAddress.location': '2dsphere' });

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
