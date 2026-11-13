const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    status: { type: String, enum: ['registered', 'pending_payment', 'attended', 'cancelled'], default: 'registered' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    registeredAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    description: { type: String, maxlength: 3000 },
    category: { type: String, default: 'General', trim: true },
    venue: { type: String, trim: true },
    startDate: { type: Date, required: [true, 'Start date is required'], index: true },
    endDate: { type: Date, required: [true, 'End date is required'] },
    registrationDeadline: Date,
    capacity: { type: Number, min: 0, default: 0 }, // 0 = unlimited
    fee: { type: Number, min: 0, default: 0 },
    banner: { url: String, publicId: String },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming', index: true },
    membersOnly: { type: Boolean, default: true },
    participants: [participantSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

eventSchema.virtual('registeredCount').get(function registeredCount() {
  return (this.participants || []).filter((p) => p.status !== 'cancelled').length;
});

eventSchema.pre('validate', function checkDates(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);
