const { User, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, escapeRegex, paginate, pageMeta } = require('../utils/helpers');

// Who may manage which roles
const MANAGEABLE = {
  superadmin: ['superadmin', 'admin', 'staff', 'member'],
  admin: ['staff'],
};

const canManage = (actor, role) => (MANAGEABLE[actor.role] || []).includes(role);

// GET /api/users?role=&q=
exports.list = asyncHandler(async (req, res) => {
  const filter = { role: { $in: MANAGEABLE[req.user.role] || [] } };
  if (req.query.role) {
    if (!canManage(req.user, req.query.role)) throw ApiError.forbidden();
    filter.role = req.query.role;
  } else {
    filter.role = { $in: (MANAGEABLE[req.user.role] || []).filter((r) => r !== 'member') };
  }
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const pg = paginate(req.query);
  const [items, total] = await Promise.all([User.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit), User.countDocuments(filter)]);
  res.json({ success: true, data: items, meta: pageMeta(total, pg) });
});

// POST /api/users  { name, email, phone, password, role } – create admin / staff accounts
exports.create = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (role === 'member') throw ApiError.badRequest('Create members from the Members page');
  if (!canManage(req.user, role)) throw ApiError.forbidden(`You cannot create ${role} accounts`);
  if (await User.exists({ email: String(email).toLowerCase() })) throw ApiError.conflict('A user with this email already exists');
  const user = await User.create({ name, email, phone, password, role, isEmailVerified: true });
  res.status(201).json({ success: true, data: user });
});

// PATCH /api/users/:id  { name, phone, role, isActive, password }
exports.update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (!canManage(req.user, user.role)) throw ApiError.forbidden();
  if (String(user._id) === String(req.user._id) && (req.body.isActive === false || (req.body.role && req.body.role !== user.role))) {
    throw ApiError.badRequest('You cannot deactivate yourself or change your own role');
  }
  ['name', 'phone'].forEach((k) => req.body[k] !== undefined && (user[k] = req.body[k]));
  if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);
  if (req.body.role && req.body.role !== user.role) {
    if (!canManage(req.user, req.body.role) || req.body.role === 'member' || user.role === 'member') throw ApiError.forbidden('Role change not allowed');
    user.role = req.body.role;
  }
  if (req.body.password) user.password = req.body.password;
  await user.save();
  res.json({ success: true, data: user });
});

// DELETE /api/users/:id
exports.remove = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (!canManage(req.user, user.role)) throw ApiError.forbidden();
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot delete your own account');
  if (user.role === 'superadmin' && (await User.countDocuments({ role: 'superadmin' })) <= 1) {
    throw ApiError.badRequest('At least one super admin must remain');
  }
  if (user.role === 'member') await Member.updateOne({ user: user._id }, { $unset: { user: 1 } });
  await user.deleteOne();
  res.json({ success: true, message: 'User deleted' });
});
