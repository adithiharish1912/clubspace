const { Coupon, Subscription } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/helpers');

const MONTH_DAYS = 30;

/** Discount (₹) a coupon gives on a plan total. Never more than the total. */
function discountFor(coupon, { total, durationDays }) {
  let d = 0;
  if (coupon.type === 'first_month_free') d = total * Math.min(1, MONTH_DAYS / (durationDays || MONTH_DAYS));
  else if (coupon.type === 'percent') d = (total * Math.min(100, coupon.value)) / 100;
  else if (coupon.type === 'flat') d = coupon.value;
  return round2(Math.min(total, Math.max(0, d)));
}

function describe(coupon) {
  if (coupon.type === 'first_month_free') return 'First month free';
  if (coupon.type === 'percent') return `${coupon.value}% off`;
  return `₹${coupon.value} off`;
}

/**
 * Checks a coupon code for a member. Throws a friendly 400 if it can't be used.
 * @returns {Promise<import('mongoose').Document>} the coupon
 */
async function validateCoupon(code, { memberId, isRenewal }) {
  const coupon = await Coupon.findOne({ code: String(code || '').trim().toUpperCase() });
  if (!coupon || !coupon.isActive) throw ApiError.badRequest('This coupon code is not valid');
  if (coupon.validUntil && coupon.validUntil < new Date()) throw ApiError.badRequest('This coupon has expired');
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) throw ApiError.badRequest('This coupon has reached its usage limit');
  if (coupon.newMembersOnly && isRenewal) throw ApiError.badRequest('This coupon is only for new members joining for the first time');
  if (coupon.oncePerMember && memberId) {
    const used = await Subscription.exists({ member: memberId, 'coupon.code': coupon.code, status: { $in: ['active', 'expired'] } });
    if (used) throw ApiError.badRequest('You have already used this coupon');
  }
  return coupon;
}

module.exports = { discountFor, describe, validateCoupon, MONTH_DAYS };
