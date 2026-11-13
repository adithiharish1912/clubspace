const env = require('../config/env');

const isWhatsAppConfigured = Boolean(env.whatsapp.token && env.whatsapp.phoneNumberId);

function normalisePhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) digits = env.whatsapp.defaultCountryCode + digits;
  return digits.length >= 11 ? digits : null;
}

/**
 * Sends a WhatsApp text message using the Meta WhatsApp Cloud API.
 * Note: outside a 24h customer-service window Meta requires an approved template;
 * set up templates in Meta Business Manager for production reminders.
 * Returns 'sent' | 'logged' | 'failed' | 'skipped'. Never throws.
 */
async function sendWhatsApp(phone, message) {
  const to = normalisePhone(phone);
  if (!to) return 'skipped';
  if (!isWhatsAppConfigured) {
    if (!env.isTest) console.log(`[whatsapp:dev] To: +${to} | ${message.slice(0, 200)}`);
    return 'logged';
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.whatsapp.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.whatsapp.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: message } }),
    });
    if (!res.ok) {
      console.error('[whatsapp] send failed:', res.status, await res.text());
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('[whatsapp] send failed:', err.message);
    return 'failed';
  }
}

module.exports = { sendWhatsApp, isWhatsAppConfigured };
