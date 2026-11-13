const mongoose = require('mongoose');

// Singleton document holding club-wide admin settings.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    clubName: { type: String, default: 'ClubSpace Club', maxlength: 120 },
    tagline: { type: String, default: 'Membership made simple' },
    logo: { url: String, publicId: String },
    email: String,
    phone: String,
    address: String,
    website: String,
    gstNumber: String,
    currency: { type: String, default: 'INR' },
    membershipIdPrefix: { type: String, default: 'CS', maxlength: 6 },
    receiptPrefix: { type: String, default: 'RCPT', maxlength: 8 },
    reminderDaysBefore: { type: [Number], default: [7, 3, 1] },
    emailNotifications: { type: Boolean, default: true },
    whatsappNotifications: { type: Boolean, default: false },
    openingTime: { type: String, default: '06:00' },
    closingTime: { type: String, default: '22:00' },
    counters: {
      member: { type: Map, of: Number, default: {} }, // per-year counter for membership IDs
      receipt: { type: Map, of: Number, default: {} },
    },
  },
  { timestamps: true }
);

settingSchema.statics.get = async function getSettings() {
  let s = await this.findOne({ key: 'global' });
  if (!s) s = await this.create({ key: 'global' });
  return s;
};

settingSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.counters;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Setting', settingSchema);
