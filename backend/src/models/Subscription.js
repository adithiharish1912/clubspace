const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    // Snapshot of the plan at purchase time, so later plan edits do not rewrite history
    planSnapshot: {
      name: String,
      code: String,
      durationType: String,
      durationDays: Number,
      price: Number,
      taxPercent: Number,
    },
    type: { type: String, enum: ['new', 'renewal'], default: 'new' },
    amount: { type: Number, required: true, min: 0 },
    startDate: Date,
    endDate: { type: Date, index: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    remindersSent: { type: [Number], default: [] }, // "days before expiry" values already notified
    expiredNoticeSent: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledReason: String,
  },
  { timestamps: true }
);

subscriptionSchema.index({ member: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
