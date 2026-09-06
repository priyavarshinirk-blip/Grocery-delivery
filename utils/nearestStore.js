const DarkStore = require('../models/DarkStore');
const AppError = require('./AppError');

// Resolves the dark store that should fulfil an order for a given delivery
// address. Strategy:
//   1. Restrict to active stores whose serviceablePincodes includes the
//      delivery pincode (a store can only ever serve its declared areas).
//   2. If more than one qualifies and geo coordinates were supplied, pick
//      the geographically nearest via a 2dsphere $near query.
//   3. Otherwise return the first serviceable match.
// Throws a 409 AppError if no store services the address at all - this is
// a business-rule rejection, not a generic validation error.
async function findNearestServiceableStore(deliveryAddress) {
  const { pincode, location } = deliveryAddress || {};
  if (!pincode) {
    throw new AppError('deliveryAddress.pincode is required to resolve a serviceable store', 400, 'VALIDATION_ERROR');
  }

  const candidates = await DarkStore.find({ isActive: true, serviceablePincodes: pincode });

  if (candidates.length === 0) {
    throw new AppError('No dark store currently services this pincode', 409, 'NO_SERVICEABLE_STORE');
  }

  if (candidates.length === 1 || !location || !Array.isArray(location.coordinates)) {
    return candidates[0];
  }

  const geoSorted = await DarkStore.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: location.coordinates },
        distanceField: 'distanceMeters',
        query: { _id: { $in: candidates.map((c) => c._id) } },
        spherical: true,
      },
    },
    { $limit: 1 },
  ]);

  if (geoSorted.length > 0) {
    return candidates.find((c) => c._id.equals(geoSorted[0]._id)) || candidates[0];
  }
  return candidates[0];
}

module.exports = { findNearestServiceableStore };
