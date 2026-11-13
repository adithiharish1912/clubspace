const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'expiry_reminder',
  'renewal_reminder',
  'membership_expired',
  'payment_confirmation',
  'payment_refund',
  'event',
  'welcome',
  'announcement',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system' },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 2000 },
    link: String,
    channels: {
      inApp: { type: Boolean, default: true },
      email: { status: { type: String, enum: ['skipped', 'sent', 'failed', 'logged'], default: 'skipped' } },
      whatsapp: { status: { type: String, enum: ['skipped', 'sent', 'failed', 'logged'], default: 'skipped' } },
    },
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
