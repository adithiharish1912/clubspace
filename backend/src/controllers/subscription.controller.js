const { Subscription } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, paginate, pageMeta } = require('../utils/helpers');
const { isStaffOrAbove } = require('../middleware/auth');
const { createPendingSubscription } = require('../services/membership.service');
const { completeFreeSubscription } = require('../services/payment.service');

// POST /api/subscriptions  { planId, memberId? }
// Members create their own (memberId ignored); staff create for any member.
exports.create = asyncHandler(async (req, res) => {
  const memberId = isStaffOrAbove(req.user) ? req.body.memberId : req.member?._id;
  if (!memberId) throw ApiError.badRequest('memberId is required');
  const { subscription, plan } = await createPendingSubscription({
    memberId,
    planId: req.body.planId,
    couponCode: req.body.couponCode,
    createdBy: req.user._id,
  });
  // Fully covered by a coupon (e.g. first month free on the Monthly plan): activate now, no payment needed
  if (subscription.amount === 0) {
    const payment = await completeFreeSubscription(subscription, { recordedBy: req.user._id });
    const active = await Subscription.findById(subscription._id);
    return res.status(201).json({ success: true, message: 'Coupon applied – your membership is active!', data: { subscription: active, plan, payment, free: true } });
  }
  return res.status(201).json({ success: true, data: { subscription, plan } });
});

// GET /api/subscriptions
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (!isStaffOrAbove(req.user)) filter.member = req.member?._id;
  else if (req.query.member) filter.member = req.query.member;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const pg = paginate(req.query);
  const [items, total] = await Promise.all([
    Subscription.find(filter)
      .sort('-createdAt')
      .skip(pg.skip)
      .limit(pg.limit)
      .populate('member', 'firstName lastName membershipId email phone')
      .populate('payment', 'receiptNo status method amount paidAt'),
    Subscription.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, pg) });
});

// PATCH /api/subscriptions/:id/cancel  (admin) – only pending ones can be cancelled here; paid ones go through refunds
exports.cancel = asyncHandler(async (req, res) => {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw ApiError.notFound('Subscription not found');
  if (sub.status !== 'pending') throw ApiError.badRequest('Only pending subscriptions can be cancelled. Use a refund for paid ones.');
  sub.status = 'cancelled';
  sub.cancelledReason = req.body.reason || 'Cancelled by admin';
  await sub.save();
  res.json({ success: true, data: sub });
});
