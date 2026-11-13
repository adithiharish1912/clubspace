const { Notification, Setting, User } = require('../models');
const { sendEmail, layout, button } = require('./email.service');
const { sendWhatsApp } = require('./whatsapp.service');
const env = require('../config/env');

const clientUrl = () => env.clientUrls[0];

/**
 * Creates an in-app notification and (optionally) sends email / WhatsApp copies.
 * @param {object} opts
 * @param {object} [opts.member]  Member document (used for email/phone/user link)
 * @param {object} [opts.user]    User document or id (recipient of the in-app notification)
 * @param {string} opts.type
 * @param {string} opts.title
 * @param {string} opts.message   Plain text message
 * @param {string} [opts.link]    Relative link inside the web app, e.g. /my/membership
 * @param {boolean} [opts.email=true]
 * @param {boolean} [opts.whatsapp=true]
 * @param {Array}  [opts.attachments] Nodemailer attachments
 */
async function notify(opts) {
  const { member, type, title, message, link, attachments, createdBy } = opts;
  const settings = await Setting.get();
  const userId = opts.user?._id || opts.user || member?.user;

  const email = member?.email || opts.user?.email;
  const phone = member?.phone || opts.user?.phone;

  let emailStatus = 'skipped';
  if (opts.email !== false && settings.emailNotifications && email) {
    const html = layout(
      title,
      `<p style="line-height:1.6;white-space:pre-line">${escapeHtml(message)}</p>${link ? button(clientUrl() + link, 'Open ClubSpace') : ''}`,
      settings.clubName
    );
    emailStatus = await sendEmail({ to: email, subject: `${title} – ${settings.clubName}`, html, text: message, attachments });
  }

  let waStatus = 'skipped';
  if (opts.whatsapp !== false && settings.whatsappNotifications && phone) {
    waStatus = await sendWhatsApp(phone, `*${settings.clubName}*\n${title}\n\n${message}`);
  }

  return Notification.create({
    user: userId || undefined,
    member: member?._id,
    type,
    title,
    message,
    link,
    channels: { inApp: Boolean(userId), email: { status: emailStatus }, whatsapp: { status: waStatus } },
    createdBy,
  });
}

/** Sends an in-app notification to every admin / superadmin (e.g. "new registration"). */
async function notifyAdmins({ type = 'system', title, message, link }) {
  const admins = await User.find({ role: { $in: ['superadmin', 'admin'] }, isActive: true }).select('_id');
  if (!admins.length) return [];
  return Notification.insertMany(
    admins.map((a) => ({ user: a._id, type, title, message, link, channels: { inApp: true } }))
  );
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

module.exports = { notify, notifyAdmins };
