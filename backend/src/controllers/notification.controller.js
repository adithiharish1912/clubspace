const { Notification, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, paginate, pageMeta } = require('../utils/helpers');
const { notify } = require('../services/notification.service');
const { runDailyJobs } = require('../services/scheduler.service');

// GET /api/notifications – current user's notifications
exports.mine = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;
  const pg = paginate({ ...req.query, limit: req.query.limit || 20 });
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, data: items, meta: { ...pageMeta(total, pg), unread } });
});

// PATCH /api/notifications/:id/read
exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true, readAt: new Date() }, { new: true });
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: n });
});

// PATCH /api/notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
  res.json({ success: true, message: 'All notifications marked as read' });
});

// DELETE /api/notifications/:id
exports.remove = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ success: true, message: 'Deleted' });
});

// GET /api/notifications/sent (admin) – log of everything sent to members
exports.sentLog = asyncHandler(async (req, res) => {
  const filter = { member: { $exists: true } };
  if (req.query.type) filter.type = req.query.type;
  const pg = paginate(req.query);
  const [items, total] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).populate('member', 'firstName lastName membershipId'),
    Notification.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, pg) });
});

// POST /api/notifications/broadcast (admin) { title, message, audience: all|active|expired|expiring, email, whatsapp }
exports.broadcast = asyncHandler(async (req, res) => {
  const { title, message, audience = 'active', email = true, whatsapp = false } = req.body;
  const filter = {};
  if (audience === 'active') filter.status = 'active';
  if (audience === 'expired') filter.status = 'expired';
  if (audience === 'expiring') {
    filter.status = 'active';
    filter.membershipExpiry = { $lte: new Date(Date.now() + 7 * 864e5) };
  }
  if (audience === 'all') filter.status = { $nin: ['cancelled'] };
  const members = await Member.find(filter).limit(5000);
  let count = 0;
  for (const m of members) {
    // eslint-disable-next-line no-await-in-loop
    await notify({ member: m, type: 'announcement', title, message, email, whatsapp, createdBy: req.user._id });
    count += 1;
  }
  res.json({ success: true, message: `Announcement sent to ${count} member(s)`, data: { count } });
});

// POST /api/notifications/run-reminders (admin) – run the daily job now
exports.runReminders = asyncHandler(async (_req, res) => {
  const result = await runDailyJobs();
  res.json({ success: true, message: 'Daily jobs completed', data: result });
});
