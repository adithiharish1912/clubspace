const mongoose = require('mongoose');

// Immutable ledger: every money movement (payment received, refund issued) creates one row.
const transactionSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    category: { type: String, enum: ['membership', 'event', 'refund', 'other'], default: 'membership' },
    amount: { type: Number, required: true, min: 0 },
    method: String,
    reference: String,
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
