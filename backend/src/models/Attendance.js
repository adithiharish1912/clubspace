const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // local day, YYYY-MM-DD
    checkIn: { type: Date, required: true },
    checkOut: Date,
    durationMinutes: Number,
    method: { type: String, enum: ['qr', 'manual', 'self'], default: 'manual' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  },
  { timestamps: true }
);

attendanceSchema.index({ date: 1, member: 1 });
attendanceSchema.index({ member: 1, checkIn: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
