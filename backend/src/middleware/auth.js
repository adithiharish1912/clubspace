const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');

/** Requires a valid JWT. Attaches req.user (and req.member for member accounts). */
const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Please log in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');
  if ((payload.v || 0) !== (user.tokenVersion || 0)) throw ApiError.unauthorized('Password changed, please log in again');

  req.user = user;
  if (user.role === 'member') {
    req.member = await Member.findOne({ user: user._id });
  }
  next();
});

/** Restrict a route to the given roles. superadmin is always allowed. */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === 'superadmin' || roles.includes(req.user.role)) return next();
  return next(ApiError.forbidden());
};

const STAFF_ROLES = ['admin', 'staff'];
const isStaffOrAbove = (user) => ['superadmin', 'admin', 'staff'].includes(user.role);
const isAdminOrAbove = (user) => ['superadmin', 'admin'].includes(user.role);

/** Members may only access their own member record; staff and above may access any. */
function assertMemberAccess(req, memberId) {
  if (isStaffOrAbove(req.user)) return;
  if (!req.member || String(req.member._id) !== String(memberId)) {
    throw ApiError.forbidden('You can only access your own records');
  }
}

module.exports = { protect, authorize, assertMemberAccess, isStaffOrAbove, isAdminOrAbove, STAFF_ROLES };
