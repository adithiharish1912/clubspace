const { Attendance, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, localDateKey, paginate, pageMeta } = require('../utils/helpers');
const { isStaffOrAbove } = require('../middleware/auth');

async function findMemberByCode(code) {
  const raw = String(code || '').trim();
  if (!raw) throw ApiError.badRequest('Scan a QR code or enter a membership ID');
  if (raw.startsWith('CLUBSPACE:')) return Member.findOne({ qrToken: raw.slice(10) });
  return Member.findOne({ membershipId: raw.toUpperCase() });
}

function assertCanEnter(member) {
  if (!member) throw ApiError.notFound('No member found for this code');
  if (member.status !== 'active' || !member.membershipExpiry || member.membershipExpiry < new Date()) {
    throw ApiError.badRequest(`${member.firstName}'s membership is ${member.status === 'active' ? 'expired' : member.status}. Entry not allowed.`);
  }
}

async function toggle(member, { method, userId }) {
  const today = localDateKey();
  const open = await Attendance.findOne({ member: member._id, date: today, checkOut: { $exists: false } }).sort('-checkIn');
  if (open) {
    open.checkOut = new Date();
    open.durationMinutes = Math.max(1, Math.round((open.checkOut - open.checkIn) / 60000));
    await open.save();
    return { action: 'check-out', record: open };
  }
  assertCanEnter(member);
  const record = await Attendance.create({ member: member._id, date: today, checkIn: new Date(), method, markedBy: userId });
  return { action: 'check-in', record };
}

// POST /api/attendance/scan { code } – toggles check-in / check-out (staff)
exports.scan = asyncHandler(async (req, res) => {
  const member = await findMemberByCode(req.body.code);
  if (!member) throw ApiError.notFound('No member found for this code');
  const result = await toggle(member, { method: String(req.body.code).startsWith('CLUBSPACE:') ? 'qr' : 'manual', userId: req.user._id });
  res.json({
    success: true,
    message: `${member.fullName} ${result.action === 'check-in' ? 'checked in' : 'checked out'}`,
    data: { ...result, member: { _id: member._id, fullName: member.fullName, membershipId: member.membershipId, photo: member.photo, membershipExpiry: member.membershipExpiry } },
  });
});

// POST /api/attendance/check-in { memberId } (staff)
exports.checkIn = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.body.memberId);
  assertCanEnter(member);
  const today = localDateKey();
  if (await Attendance.exists({ member: member._id, date: today, checkOut: { $exists: false } })) {
    throw ApiError.badRequest(`${member.fullName} is already checked in`);
  }
  const record = await Attendance.create({ member: member._id, date: today, checkIn: new Date(), method: 'manual', markedBy: req.user._id, notes: req.body.notes });
  res.status(201).json({ success: true, message: `${member.fullName} checked in`, data: record });
});

// POST /api/attendance/check-out { memberId } (staff)
exports.checkOut = asyncHandler(async (req, res) => {
  const record = await Attendance.findOne({ member: req.body.memberId, checkOut: { $exists: false } }).sort('-checkIn');
  if (!record) throw ApiError.badRequest('Member is not checked in');
  record.checkOut = new Date();
  record.durationMinutes = Math.max(1, Math.round((record.checkOut - record.checkIn) / 60000));
  await record.save();
  res.json({ success: true, message: 'Checked out', data: record });
});

// GET /api/attendance?date=YYYY-MM-DD&member=&from=&to=
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (!isStaffOrAbove(req.user)) filter.member = req.member?._id;
  else if (req.query.member) filter.member = req.query.member;
  if (req.query.date) filter.date = req.query.date;
  else if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = req.query.from;
    if (req.query.to) filter.date.$lte = req.query.to;
  }
  if (req.query.inside === 'true') filter.checkOut = { $exists: false };
  const pg = paginate(req.query);
  const [items, total] = await Promise.all([
    Attendance.find(filter).sort('-checkIn').skip(pg.skip).limit(pg.limit).populate('member', 'firstName lastName membershipId photo').populate('markedBy', 'name'),
    Attendance.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, pg) });
});

// GET /api/attendance/summary – today's numbers + last 7 days (staff)
exports.summary = asyncHandler(async (_req, res) => {
  const today = localDateKey();
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return localDateKey(d);
  });
  const [todayCount, inside, byDay] = await Promise.all([
    Attendance.countDocuments({ date: today }),
    Attendance.countDocuments({ date: today, checkOut: { $exists: false } }),
    Attendance.aggregate([{ $match: { date: { $in: days } } }, { $group: { _id: '$date', count: { $sum: 1 } } }]),
  ]);
  const map = Object.fromEntries(byDay.map((d) => [d._id, d.count]));
  res.json({ success: true, data: { today, todayCount, inside, last7Days: days.map((d) => ({ date: d, count: map[d] || 0 })) } });
});
