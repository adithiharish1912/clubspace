const { MembershipPlan, Subscription } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');
const { isAdminOrAbove } = require('../middleware/auth');

const FIELDS = ['name', 'code', 'description', 'durationType', 'durationDays', 'price', 'taxPercent', 'features', 'isPremium', 'isActive', 'color', 'sortOrder'];
const pick = (b) => FIELDS.reduce((a, k) => (b[k] !== undefined ? { ...a, [k]: b[k] } : a), {});

// GET /api/plans – members see active plans only
exports.list = asyncHandler(async (req, res) => {
  const filter = isAdminOrAbove(req.user) && req.query.all === 'true' ? {} : { isActive: true };
  const plans = await MembershipPlan.find(filter).sort('sortOrder price');
  res.json({ success: true, data: plans });
});

exports.get = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  res.json({ success: true, data: plan });
});

exports.create = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.create(pick(req.body));
  res.status(201).json({ success: true, data: plan });
});

exports.update = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  Object.assign(plan, pick(req.body));
  await plan.save();
  res.json({ success: true, data: plan });
});

// DELETE – plans with subscriptions are deactivated instead of deleted (history must stay intact)
exports.remove = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  if (await Subscription.exists({ plan: plan._id })) {
    plan.isActive = false;
    await plan.save();
    return res.json({ success: true, message: 'Plan has subscriptions, so it was deactivated instead of deleted', data: plan });
  }
  await plan.deleteOne();
  return res.json({ success: true, message: 'Plan deleted' });
});
