const QRCode = require('qrcode');
const crypto = require('crypto');
const env = require('../config/env');
const { Member, User, Subscription, Payment, Attendance } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, escapeRegex, paginate, pageMeta, addDays } = require('../utils/helpers');
const { assertMemberAccess, isStaffOrAbove } = require('../middleware/auth');
const { generateMembershipId } = require('../services/counter.service');
const { uploadImage, deleteImage } = require('../services/upload.service');
const { createPendingSubscription } = require('../services/membership.service');
const { notify } = require('../services/notification.service');

const EDITABLE = ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'address', 'emergencyContact', 'occupation', 'notes'];
const SELF_EDITABLE = ['phone', 'address', 'emergencyContact', 'occupation', 'gender', 'dateOfBirth'];

const pick = (obj, keys) => keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

// GET /api/members
exports.list = asyncHandler(async (req, res) => {
  const { q, status, gender, expiring, sort = '-createdAt' } = req.query;
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }, { membershipId: rx }];
  }
  if (status) filter.status = status;
  if (gender) filter.gender = gender;
  if (expiring) {
    filter.status = 'active';
    filter.membershipExpiry = { $gte: new Date(), $lte: addDays(new Date(), Number(expiring) || 7) };
  }
  const allowedSort = ['createdAt', '-createdAt', 'firstName', '-firstName', 'membershipExpiry', '-membershipExpiry', 'membershipId'];
  const pg = paginate(req.query);
  const [items, total] = await Promise.all([
    Member.find(filter)
      .sort(allowedSort.includes(sort) ? sort : '-createdAt')
      .skip(pg.skip)
      .limit(pg.limit)
      .populate('currentSubscription', 'planSnapshot startDate endDate status'),
    Member.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, pg) });
});

// GET /api/members/:id
exports.get = asyncHandler(async (req, res) => {
  assertMemberAccess(req, req.params.id);
  const member = await Member.findById(req.params.id)
    .populate('currentSubscription')
    .populate('user', 'email role isActive isEmailVerified lastLoginAt');
  if (!member) throw ApiError.notFound('Member not found');

  const [subscriptions, payments, attendanceCount, lastVisit] = await Promise.all([
    Subscription.find({ member: member._id }).sort('-createdAt').limit(50),
    Payment.find({ member: member._id }).sort('-createdAt').limit(50),
    Attendance.countDocuments({ member: member._id }),
    Attendance.findOne({ member: member._id }).sort('-checkIn'),
  ]);
  res.json({ success: true, data: { member, subscriptions, payments, stats: { attendanceCount, lastVisit: lastVisit?.checkIn || null } } });
});

// POST /api/members  (staff+)
exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body, EDITABLE);
  const { createLogin, password, planId } = req.body;
  let user;
  if (createLogin) {
    if (await User.exists({ email: String(data.email).toLowerCase() })) throw ApiError.conflict('A user with this email already exists');
    user = await User.create({
      name: `${data.firstName} ${data.lastName || ''}`.trim(),
      email: data.email,
      phone: data.phone,
      password: password || crypto.randomBytes(9).toString('base64url'),
      role: 'member',
      isEmailVerified: false,
    });
  }
  let member;
  try {
    member = await Member.create({ ...data, user: user?._id, membershipId: await generateMembershipId(), createdBy: req.user._id });
  } catch (err) {
    if (user) await User.deleteOne({ _id: user._id });
    throw err;
  }

  let subscription;
  if (planId) ({ subscription } = await createPendingSubscription({ memberId: member._id, planId, createdBy: req.user._id }));

  await notify({
    member,
    user,
    type: 'welcome',
    title: 'Congratulations! Your membership account is created',
    message: `Dear ${member.firstName},

Congratulations! You have been registered as a member successfully.

Membership ID: ${member.membershipId}${
      user
        ? `
Login ID: ${user.email}
Password: ${password ? 'the password given to you at the club office (please change it after your first login under My Profile)' : 'use "Forgot password" on the login page to set your own password'}

Please log in at ${env.clientUrls[0]}/login

Please keep your password private and do not share it with anyone.`
        : ''
    }

We are delighted to welcome you to the club!`,
    link: '/login',
  });
  res.status(201).json({ success: true, data: { member, subscription } });
});

// PATCH /api/members/:id
exports.update = asyncHandler(async (req, res) => {
  assertMemberAccess(req, req.params.id);
  const member = await Member.findById(req.params.id);
  if (!member) throw ApiError.notFound('Member not found');
  const updates = pick(req.body, isStaffOrAbove(req.user) ? EDITABLE : SELF_EDITABLE);
  Object.assign(member, updates);
  await member.save();
  if (member.user && (updates.firstName || updates.lastName || updates.phone || updates.email)) {
    await User.updateOne(
      { _id: member.user },
      { name: member.fullName, phone: member.phone, ...(updates.email ? { email: member.email } : {}) }
    );
  }
  res.json({ success: true, data: member });
});

// PATCH /api/members/:id/status  (admin)
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const member = await Member.findById(req.params.id);
  if (!member) throw ApiError.notFound('Member not found');
  if (status === 'active' && !(member.membershipExpiry && member.membershipExpiry > new Date())) {
    throw ApiError.badRequest('Member has no valid subscription – collect a payment to activate');
  }
  member.status = status;
  if (reason) member.notes = `${member.notes ? `${member.notes}\n` : ''}[${new Date().toLocaleDateString('en-IN')}] ${status}: ${reason}`;
  await member.save();
  if (member.user) await User.updateOne({ _id: member.user }, { isActive: status !== 'cancelled' });
  res.json({ success: true, data: member });
});

// DELETE /api/members/:id  (admin) – only allowed when no payments exist; otherwise cancel instead
exports.remove = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw ApiError.notFound('Member not found');
  if (await Payment.exists({ member: member._id, status: { $in: ['paid', 'refunded', 'partially_refunded'] } })) {
    throw ApiError.badRequest('Member has payment history and cannot be deleted. Set the status to "cancelled" instead.');
  }
  await Promise.all([
    Subscription.deleteMany({ member: member._id }),
    Payment.deleteMany({ member: member._id }),
    Attendance.deleteMany({ member: member._id }),
    member.user ? User.deleteOne({ _id: member.user }) : null,
    deleteImage(member.photo?.publicId),
  ]);
  await member.deleteOne();
  res.json({ success: true, message: 'Member deleted' });
});

// POST /api/members/:id/photo  (multipart "photo")
exports.uploadPhoto = asyncHandler(async (req, res) => {
  assertMemberAccess(req, req.params.id);
  if (!req.file) throw ApiError.badRequest('Please choose an image');
  const member = await Member.findById(req.params.id);
  if (!member) throw ApiError.notFound('Member not found');
  const img = await uploadImage(req.file, 'members');
  await deleteImage(member.photo?.publicId);
  member.photo = img;
  await member.save();
  if (member.user) await User.updateOne({ _id: member.user }, { avatar: img });
  res.json({ success: true, data: member });
});

// GET /api/members/:id/qr – QR code (PNG data URL) for attendance
exports.qr = asyncHandler(async (req, res) => {
  assertMemberAccess(req, req.params.id);
  const member = await Member.findById(req.params.id);
  if (!member) throw ApiError.notFound('Member not found');
  const payload = `CLUBSPACE:${member.qrToken}`;
  const dataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
  res.json({ success: true, data: { dataUrl, membershipId: member.membershipId } });
});

// POST /api/members/:id/qr/regenerate – invalidates the old QR (lost card)
exports.regenerateQr = asyncHandler(async (req, res) => {
  assertMemberAccess(req, req.params.id);
  const member = await Member.findByIdAndUpdate(req.params.id, { qrToken: crypto.randomBytes(16).toString('hex') }, { new: true });
  if (!member) throw ApiError.notFound('Member not found');
  res.json({ success: true, message: 'QR code regenerated' });
});

// GET /api/members/:id/subscriptions – membership history
exports.subscriptions = asyncHandler(async (req, res) => {
  assertMemberAccess(req, req.params.id);
  const subs = await Subscription.find({ member: req.params.id }).sort('-createdAt').populate('payment', 'receiptNo status method amount paidAt');
  res.json({ success: true, data: subs });
});
