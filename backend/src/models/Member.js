const mongoose = require('mongoose');
const crypto = require('crypto');

const MEMBER_STATUS = ['pending', 'active', 'expired', 'suspended', 'cancelled'];

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    membershipId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    firstName: { type: String, required: [true, 'First name is required'], trim: true, maxlength: 60 },
    lastName: { type: String, trim: true, maxlength: 60, default: '' },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
      index: true,
    },
    phone: { type: String, required: [true, 'Phone is required'], trim: true, maxlength: 20 },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    dateOfBirth: Date,
    address: {
      line1: String,
      city: String,
      state: String,
      pincode: String,
    },
    emergencyContact: { name: String, phone: String, relation: String },
    occupation: String,
    photo: { url: String, publicId: String },
    status: { type: String, enum: MEMBER_STATUS, default: 'pending', index: true },
    currentSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    membershipExpiry: { type: Date, index: true },
    joinedAt: { type: Date, default: Date.now },
    qrToken: { type: String, unique: true, default: () => crypto.randomBytes(16).toString('hex') },
    notes: { type: String, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

memberSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName || ''}`.trim();
});

memberSchema.index({ firstName: 'text', lastName: 'text', email: 'text', membershipId: 'text', phone: 'text' });
memberSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Member', memberSchema);
module.exports.MEMBER_STATUS = MEMBER_STATUS;
