const mongoose = require('mongoose');

/**
 * Discount coupons entered at checkout.
 *  first_month_free – takes one month's worth (30 days) of the chosen plan off the price.
 *                     On the Monthly plan this makes the first month free (₹0).
 *  percent          – value % off the total.
 *  flat             – value ₹ off the total.
 */
const COUPON_TYPES = ['first_month_free', 'percent', 'flat'];

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, 'Code is required'], unique: true, uppercase: true, trim: true, maxlength: 30, match: [/^[A-Z0-9_-]+$/, 'Code may contain letters, numbers, - and _'] },
    description: { type: String, maxlength: 200 },
    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, default: 0, min: 0 },
    newMembersOnly: { type: Boolean, default: true }, // only for a member's first membership
    oncePerMember: { type: Boolean, default: true },
    maxUses: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    validUntil: Date,
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
module.exports.COUPON_TYPES = COUPON_TYPES;
