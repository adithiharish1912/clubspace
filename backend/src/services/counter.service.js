const { Setting } = require('../models');

/** Atomically increments a per-year counter stored on the settings document. */
async function nextCounter(kind) {
  const year = new Date().getFullYear();
  await Setting.get(); // ensure the singleton exists
  const doc = await Setting.findOneAndUpdate(
    { key: 'global' },
    { $inc: { [`counters.${kind}.${year}`]: 1 } },
    { new: true }
  );
  const value = doc.counters?.[kind]?.get ? doc.counters[kind].get(String(year)) : doc.counters?.[kind]?.[year];
  return { year, value, settings: doc };
}

/** e.g. CS-2026-00042 */
async function generateMembershipId() {
  const { year, value, settings } = await nextCounter('member');
  return `${settings.membershipIdPrefix || 'CS'}-${year}-${String(value).padStart(5, '0')}`;
}

/** e.g. RCPT-2026-000123 */
async function generateReceiptNo() {
  const { year, value, settings } = await nextCounter('receipt');
  return `${settings.receiptPrefix || 'RCPT'}-${year}-${String(value).padStart(6, '0')}`;
}

module.exports = { generateMembershipId, generateReceiptNo };
