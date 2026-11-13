const mongoose = require('mongoose');

const PAYMENT_STATUS = ['created', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'];
const PAYMENT_METHODS = ['razorpay', 'cash', 'upi', 'card', 'bank_transfer', 'cheque', 'demo'];

const refundSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: String,
    razorpayRefundId: String,
    status: { type: String, enum: ['processed', 'pending', 'failed'], default: 'processed' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, unique: true, sparse: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    purpose: { type: String, enum: ['membership', 'event', 'other'], default: 'membership' },
    description: String,
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: PAYMENT_METHODS, default: 'razorpay' },
    status: { type: String, enum: PAYMENT_STATUS, default: 'created', index: true },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String, select: false },
    referenceNo: String,
    refundedAmount: { type: Number, default: 0 },
    refunds: [refundSchema],
    paidAt: { type: Date, index: true },
    failureReason: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1, paidAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
