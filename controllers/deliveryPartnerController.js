const DeliveryPartner = require('../models/DeliveryPartner');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

// GET /api/delivery-partners (admin, store_staff) - used when picking whom to assign
const listPartners = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.isAvailable !== undefined) filter.isAvailable = req.query.isAvailable === 'true';

  const partners = await DeliveryPartner.find(filter).populate('userId', 'name email phone');
  return sendSuccess(res, 200, 'Delivery partners fetched', { partners });
});

// GET /api/delivery-partners/me
const getMyProfile = catchAsync(async (req, res, next) => {
  const partner = await DeliveryPartner.findOne({ userId: req.user._id });
  if (!partner) return next(new AppError('Delivery partner profile not found', 404, 'NOT_FOUND'));
  return sendSuccess(res, 200, 'Delivery partner profile fetched', { partner });
});

// PATCH /api/delivery-partners/me/availability (delivery_partner)
const setAvailability = catchAsync(async (req, res, next) => {
  const partner = await DeliveryPartner.findOne({ userId: req.user._id });
  if (!partner) return next(new AppError('Delivery partner profile not found', 404, 'NOT_FOUND'));

  if (partner.currentOrder && req.body.isAvailable === true) {
    return next(new AppError('Cannot go available while an order is still in progress', 409, 'ORDER_IN_PROGRESS'));
  }

  partner.isAvailable = req.body.isAvailable;
  await partner.save();
  return sendSuccess(res, 200, 'Availability updated successfully', { partner });
});

module.exports = { listPartners, getMyProfile, setAvailability };
