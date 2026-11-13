const { Member, Subscription, Payment, Attendance, Event, MembershipPlan, Notification } = require('../models');
const { asyncHandler, startOfDay, localDateKey, addDays, round2 } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

const PAID = ['paid', 'partially_refunded', 'refunded'];

// GET /api/dashboard/admin
exports.admin = asyncHandler(async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    totalMembers,
    statusAgg,
    revenueAgg,
    monthRevenueAgg,
    pendingAgg,
    newThisMonth,
    expiringSoon,
    monthly,
    planMix,
    registrations,
    todayAttendance,
    upcomingEvents,
    recentMembers,
    recentPayments,
  ] = await Promise.all([
    Member.countDocuments(),
    Member.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: { $in: PAID } } }, { $group: { _id: null, gross: { $sum: '$amount' }, refunded: { $sum: '$refundedAmount' } } }]),
    Payment.aggregate([{ $match: { status: { $in: PAID }, paidAt: { $gte: monthStart } } }, { $group: { _id: null, gross: { $sum: '$amount' }, refunded: { $sum: '$refundedAmount' } } }]),
    Subscription.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    Member.countDocuments({ createdAt: { $gte: monthStart } }),
    Member.countDocuments({ status: 'active', membershipExpiry: { $gte: now, $lte: addDays(now, 7) } }),
    Payment.find({ status: { $in: PAID }, paidAt: { $gte: yearAgo } }).select('paidAt amount refundedAmount').lean(),
    Subscription.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$planSnapshot.name', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Member.find({ createdAt: { $gte: yearAgo } }).select('createdAt').lean(),
    Attendance.countDocuments({ date: localDateKey() }),
    Event.countDocuments({ status: 'upcoming', startDate: { $gte: startOfDay() } }),
    Member.find().sort('-createdAt').limit(6).select('firstName lastName membershipId status photo createdAt email'),
    Payment.find({ status: { $in: PAID } }).sort('-paidAt').limit(6).populate('member', 'firstName lastName membershipId'),
  ]);

  const byStatus = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const rev = revenueAgg[0] || { gross: 0, refunded: 0 };
  const mrev = monthRevenueAgg[0] || { gross: 0, refunded: 0 };

  // Fill 12 months, oldest first
  const months = [...Array(12)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1, label: d.toLocaleString('en-US', { month: 'short' }) };
  });
  // Bucket by month in JS (works on any MongoDB-compatible backend, timezone = server TZ)
  const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}`;
  const revMap = {};
  monthly.forEach((p) => {
    const k = key(new Date(p.paidAt));
    revMap[k] = revMap[k] || { revenue: 0, refunded: 0, count: 0 };
    revMap[k].revenue += p.amount;
    revMap[k].refunded += p.refundedAmount || 0;
    revMap[k].count += 1;
  });
  const regMap = {};
  registrations.forEach((m) => {
    const k = key(new Date(m.createdAt));
    regMap[k] = (regMap[k] || 0) + 1;
  });
  const monthlyRevenue = months.map(({ y, m, label }) => {
    const r = revMap[`${y}-${m}`];
    return { month: label, revenue: round2((r?.revenue || 0) - (r?.refunded || 0)), payments: r?.count || 0, registrations: regMap[`${y}-${m}`] || 0 };
  });

  res.json({
    success: true,
    data: {
      cards: {
        totalMembers,
        activeMembers: byStatus.active || 0,
        expiredMembers: byStatus.expired || 0,
        pendingMembers: byStatus.pending || 0,
        suspendedMembers: (byStatus.suspended || 0) + (byStatus.cancelled || 0),
        totalRevenue: round2(rev.gross - rev.refunded),
        monthRevenue: round2(mrev.gross - mrev.refunded),
        pendingPayments: pendingAgg[0]?.count || 0,
        pendingAmount: round2(pendingAgg[0]?.amount || 0),
        newRegistrations: newThisMonth,
        expiringSoon,
        todayAttendance,
        upcomingEvents,
      },
      monthlyRevenue,
      membershipStatus: ['active', 'pending', 'expired', 'suspended', 'cancelled'].map((s) => ({ name: s, value: byStatus[s] || 0 })),
      planMix: planMix.map((p) => ({ name: p._id || 'Unknown', value: p.count })),
      recentMembers,
      recentPayments,
    },
  });
});

// GET /api/dashboard/member – the logged-in member's overview
exports.member = asyncHandler(async (req, res) => {
  if (!req.member) throw ApiError.notFound('No member profile is linked to this account');
  const m = await Member.findById(req.member._id).populate('currentSubscription');
  const monthStart = localDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [visitsThisMonth, totalVisits, recentAttendance, payments, pendingSub, events, unread, plans] = await Promise.all([
    Attendance.countDocuments({ member: m._id, date: { $gte: monthStart } }),
    Attendance.countDocuments({ member: m._id }),
    Attendance.find({ member: m._id }).sort('-checkIn').limit(5),
    Payment.find({ member: m._id }).sort('-createdAt').limit(5),
    Subscription.findOne({ member: m._id, status: 'pending' }).sort('-createdAt'),
    Event.find({ status: 'upcoming', startDate: { $gte: new Date() } }).sort('startDate').limit(4).select('-participants'),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
    MembershipPlan.find({ isActive: true }).sort('sortOrder price').limit(6),
  ]);
  const daysLeft = m.membershipExpiry ? Math.ceil((m.membershipExpiry - new Date()) / 864e5) : null;
  res.json({
    success: true,
    data: { member: m, daysLeft, visitsThisMonth, totalVisits, recentAttendance, payments, pendingSubscription: pendingSub, upcomingEvents: events, unread, plans },
  });
});

// GET /api/dashboard/staff
exports.staff = asyncHandler(async (_req, res) => {
  const today = localDateKey();
  const [todayCount, inside, expiringSoon, pendingPayments, recent] = await Promise.all([
    Attendance.countDocuments({ date: today }),
    Attendance.countDocuments({ date: today, checkOut: { $exists: false } }),
    Member.countDocuments({ status: 'active', membershipExpiry: { $gte: new Date(), $lte: addDays(new Date(), 7) } }),
    Subscription.countDocuments({ status: 'pending' }),
    Attendance.find({ date: today }).sort('-checkIn').limit(10).populate('member', 'firstName lastName membershipId photo'),
  ]);
  res.json({ success: true, data: { todayCount, inside, expiringSoon, pendingPayments, recent } });
});
