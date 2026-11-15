const env = require('../config/env');
const { User, Member, Setting } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, hashToken, randomToken } = require('../utils/helpers');
const { signAccessToken } = require('../services/token.service');
const { sendEmail, layout, button, isEmailConfigured } = require('../services/email.service');
const { notify, notifyAdmins } = require('../services/notification.service');
const { generateMembershipId } = require('../services/counter.service');
const { uploadImage, deleteImage } = require('../services/upload.service');

const clientUrl = () => env.clientUrls[0];
// In local development without SMTP, return links in the API response so the flow can be tested.
const exposeDevLinks = () => !env.isProd && !isEmailConfigured;

async function issueVerification(user) {
  const token = randomToken();
  user.emailVerifyToken = hashToken(token);
  user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  const url = `${clientUrl()}/verify-email/${token}`;
  const settings = await Setting.get();
  await sendEmail({
    to: user.email,
    subject: `Verify your email – ${settings.clubName}`,
    html: layout('Verify your email', `<p>Hi ${user.name}, please confirm your email address.</p>${button(url, 'Verify email')}<p style="color:#64748b;font-size:13px">This link expires in 24 hours.</p>`, settings.clubName),
    text: `Verify your email: ${url}`,
  });
  return url;
}

async function authPayload(user) {
  const member = user.role === 'member' ? await Member.findOne({ user: user._id }).populate('currentSubscription') : null;
  return { token: signAccessToken(user), user, member };
}

// POST /api/auth/register  (public – creates a member account)
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName = '', email, phone, password, gender, dateOfBirth } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name: `${firstName} ${lastName}`.trim(), email, phone, password, role: 'member' });
  let member;
  try {
    member = await Member.create({
      user: user._id,
      membershipId: await generateMembershipId(),
      firstName,
      lastName,
      email,
      phone,
      gender: gender || '',
      dateOfBirth: dateOfBirth || undefined,
      status: 'pending',
      createdBy: user._id,
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  const verifyUrl = await issueVerification(user);
  await notify({
    user,
    member,
    type: 'welcome',
    title: 'Congratulations! Your membership account is created',
    message: `Hi ${firstName},

Congratulations! Your ClubSpace member account has been created successfully.

Membership ID: ${member.membershipId}
Login ID: ${user.email}
Password: the password you chose while registering

Log in at ${clientUrl()}/login and choose a membership plan to activate your membership.

Welcome to the club!`,
    link: '/login',
    whatsapp: false,
  });
  await notifyAdmins({ title: 'New member registration', message: `${member.fullName} (${member.membershipId}) just registered.`, link: `/members/${member._id}` });

  const payload = env.requireEmailVerification ? { user, member } : await authPayload(user);
  res.status(201).json({
    success: true,
    message: env.requireEmailVerification
      ? 'Registration successful. Please verify your email before logging in.'
      : 'Registration successful',
    data: { ...payload, ...(exposeDevLinks() ? { devVerifyUrl: verifyUrl } : {}) },
  });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Contact the club office.');
  if (env.requireEmailVerification && !user.isEmailVerified && user.role === 'member') {
    throw ApiError.forbidden('Please verify your email before logging in');
  }
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, data: await authPayload(user) });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  const member = req.member ? await Member.findById(req.member._id).populate('currentSubscription') : null;
  res.json({ success: true, data: { user: req.user, member } });
});

// POST /api/auth/logout – JWTs are stateless; the client discards the token.
exports.logout = asyncHandler(async (_req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/auth/verify-email/:token
exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    emailVerifyToken: hashToken(req.params.token),
    emailVerifyExpires: { $gt: new Date() },
  });
  if (!user) throw ApiError.badRequest('Verification link is invalid or has expired');
  user.isEmailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Email verified successfully' });
});

// POST /api/auth/resend-verification  (logged in)
exports.resendVerification = asyncHandler(async (req, res) => {
  if (req.user.isEmailVerified) return res.json({ success: true, message: 'Email is already verified' });
  const url = await issueVerification(req.user);
  return res.json({ success: true, message: 'Verification email sent', ...(exposeDevLinks() ? { devVerifyUrl: url } : {}) });
});

// POST /api/auth/forgot-password
exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email).toLowerCase() });
  let devResetUrl;
  if (user && user.isActive) {
    const token = randomToken();
    user.resetPasswordToken = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const url = `${clientUrl()}/reset-password/${token}`;
    const settings = await Setting.get();
    await sendEmail({
      to: user.email,
      subject: `Reset your password – ${settings.clubName}`,
      html: layout('Reset your password', `<p>Hi ${user.name}, click below to choose a new password.</p>${button(url, 'Reset password')}<p style="color:#64748b;font-size:13px">This link expires in 30 minutes. If you did not request it, ignore this email.</p>`, settings.clubName),
      text: `Reset your password: ${url}`,
    });
    if (exposeDevLinks()) devResetUrl = url;
  }
  // Same response whether or not the email exists (prevents account enumeration)
  res.json({ success: true, message: 'If that email is registered, a reset link has been sent.', ...(devResetUrl ? { devResetUrl } : {}) });
});

// POST /api/auth/reset-password/:token
exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: hashToken(req.params.token),
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw ApiError.badRequest('Reset link is invalid or has expired');
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.isEmailVerified = true; // they proved inbox ownership
  await user.save();
  res.json({ success: true, message: 'Password reset successfully. Please log in.' });
});

// PATCH /api/auth/change-password
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: 'Password changed', data: { token: signAccessToken(user) } });
});

// PATCH /api/auth/profile  (multipart: name, phone, avatar)
exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (req.body.name) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.file) {
    const img = await uploadImage(req.file, 'avatars');
    await deleteImage(user.avatar?.publicId);
    user.avatar = img;
    if (req.member) {
      await Member.updateOne({ _id: req.member._id }, { photo: img });
    }
  }
  await user.save();
  if (req.member && req.body.phone) await Member.updateOne({ _id: req.member._id }, { phone: req.body.phone });
  res.json({ success: true, data: { user } });
});
