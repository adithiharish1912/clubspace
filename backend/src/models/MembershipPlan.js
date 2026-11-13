const mongoose = require('mongoose');

const DURATION_TYPES = ['monthly', 'quarterly', 'half-yearly', 'annual', 'custom'];
const DEFAULT_DAYS = { monthly: 30, quarterly: 90, 'half-yearly': 180, annual: 365 };

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Plan name is required'], trim: true, maxlength: 80 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
    description: { type: String, maxlength: 500 },
    durationType: { type: String, enum: DURATION_TYPES, required: true },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    price: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0, max: 50 },
    features: [{ type: String, trim: true }],
    isPremium: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    color: { type: String, default: '#2563eb' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

planSchema.virtual('totalPrice').get(function totalPrice() {
  return Math.round(this.price * (1 + (this.taxPercent || 0) / 100) * 100) / 100;
});

planSchema.pre('validate', function setDays(next) {
  if (!this.durationDays && DEFAULT_DAYS[this.durationType]) {
    this.durationDays = DEFAULT_DAYS[this.durationType];
  }
  next();
});

module.exports = mongoose.model('MembershipPlan', planSchema);
module.exports.DURATION_TYPES = DURATION_TYPES;
module.exports.DEFAULT_DAYS = DEFAULT_DAYS;
