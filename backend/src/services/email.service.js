const nodemailer = require('nodemailer');
const env = require('../config/env');

const useBrevo = Boolean(env.brevoApiKey);
const smtpReady = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
const isEmailConfigured = useBrevo || smtpReady;

const transporter =
  !useBrevo && smtpReady
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      })
    : null;

/** "ClubSpace <club@gmail.com>" -> { name: 'ClubSpace', email: 'club@gmail.com' } */
function parseFrom(from) {
  const m = String(from || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || 'ClubSpace', email: m[2].trim() };
  return { name: 'ClubSpace', email: String(from || '').trim() || env.smtp.user };
}

/** Sends through Brevo's HTTPS API (port 443, never blocked). */
async function sendViaBrevo({ to, subject, html, text, attachments }) {
  const body = {
    sender: parseFrom(env.smtp.from),
    to: [{ email: to }],
    subject,
    htmlContent: html || `<p>${text || ''}</p>`,
    ...(text ? { textContent: text } : {}),
    ...(attachments?.length
      ? { attachment: attachments.map((a) => ({ name: a.filename, content: Buffer.from(a.content).toString('base64') })) }
      : {}),
  };
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

function layout(title, bodyHtml, clubName = 'ClubSpace') {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
  <tr><td style="background:#1d4ed8;color:#fff;padding:20px 28px;font-size:20px;font-weight:700">${clubName}</td></tr>
  <tr><td style="padding:28px"><h2 style="margin:0 0 12px;font-size:20px">${title}</h2>${bodyHtml}</td></tr>
  <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">This is an automated message from ${clubName}.</td></tr>
  </table></td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;

/**
 * Sends an email. Returns 'sent', 'logged' (no SMTP configured) or 'failed'.
 * Never throws – notification failures must not break the main request.
 */
async function sendEmail({ to, subject, html, text, attachments }) {
  if (!to) return 'skipped';
  if (!isEmailConfigured) {
    if (!env.isTest) console.log(`[email:dev] To: ${to} | ${subject}\n${text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400)}`);
    return 'logged';
  }
  try {
    if (useBrevo) await sendViaBrevo({ to, subject, html, text, attachments });
    else await transporter.sendMail({ from: env.smtp.from, to, subject, html, text, attachments });
    return 'sent';
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return 'failed';
  }
}

module.exports = { sendEmail, layout, button, isEmailConfigured };
