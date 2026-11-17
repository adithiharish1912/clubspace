const { Coupon, MembershipPlan, Subscription } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, round2 } = require('../utils/helpers');
const { isStaffOrAbove } = require('../middleware/auth');
const { validateCoupon, discountFor, describe } = require('../services/coupon.service');

const FIELDS = ['code', 'description', 'type', 'value', 'newMembersOnly', 'oncePerMember', 'maxUses', 'validUntil', 'isActive'];
const pick = (b) => FIELDS.reduce((a, k) => (b[k] !== undefined && b[k] !== '' ? { ...a, [k]: b[k] } : a), {});

// POST /api/coupons/validate { code, planId?, memberId? }
// Checks a code for the member and returns the discount for one plan (planId) or for every active plan.
exports.validate = asyncHandler(async (req, res) => {
  const memberId = isStaffOrAbove(req.user) ? req.body.memberId : req.member?._id;
  const isRenewal = memberId ? Boolean(await Subscription.exists({ member: memberId, status: { $in: ['active', 'expired'] } })) : false;
  const coupon = await validateCoupon(req.body.code, { memberId, isRenewal });
  const plans = req.body.planId ? await MembershipPlan.find({ _id: req.body.planId, isActive: true }) : await MembershipPlan.find({ isActive: true });
  const prices = plans.map((p) => {
    const total = round2(p.price * (1 + (p.taxPercent || 0) / 100));
    const discount = discountFor(coupon, { total, durationDays: p.durationDays });
    return { planId: p._id, total, discount, payable: round2(total - discount) };
  });
  res.json({
    success: true,
    message: `Coupon ${coupon.code} applied: ${describe(coupon)}`,
    data: { code: coupon.code, label: describe(coupon), description: coupon.description, type: coupon.type, value: coupon.value, prices },
  });
});

// GET /api/coupons (admin)
exports.list = asyncHandler(async (_req, res) => {
  const coupons = await Coupon.find().sort('-createdAt');
  res.json({ success: true, data: coupons });
});

// POST /api/coupons (admin)
exports.create = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create({ ...pick(req.body), createdBy: req.user._id });
  res.status(201).json({ success: true, data: coupon });
});

// PATCH /api/coupons/:id (admin)
exports.update = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  const data = pick(req.body);
  if (req.body.validUntil === '' || req.body.validUntil === null) coupon.validUntil = undefined;
  Object.assign(coupon, data);
  await coupon.save();
  res.json({ success: true, data: coupon });
});

// DELETE /api/coupons/:id (admin) – used coupons are switched off instead, to keep history readable
exports.remove = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  if (coupon.usedCount > 0) {
    coupon.isActive = false;
    await coupon.save();
    return res.json({ success: true, message: 'Coupon has been used, so it was switched off instead of deleted', data: coupon });
  }
  await coupon.deleteOne();
  return res.json({ success: true, message: 'Coupon deleted' });
});
