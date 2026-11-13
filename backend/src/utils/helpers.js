const crypto = require('crypto');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Local date string YYYY-MM-DD in the server timezone (TZ env). */
function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Resolve a {from,to} range from query params or a period keyword. */
function resolveRange({ from, to, period, date } = {}) {
  const base = date ? new Date(date) : new Date();
  if (period === 'daily') return { from: startOfDay(base), to: endOfDay(base) };
  if (period === 'monthly') {
    return {
      from: new Date(base.getFullYear(), base.getMonth(), 1),
      to: endOfDay(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
    };
  }
  if (period === 'annual') {
    return { from: new Date(base.getFullYear(), 0, 1), to: endOfDay(new Date(base.getFullYear(), 11, 31)) };
  }
  return {
    from: from ? startOfDay(new Date(from)) : new Date(base.getFullYear(), base.getMonth(), 1),
    to: to ? endOfDay(new Date(to)) : endOfDay(base),
  };
}

function paginate(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

function pageMeta(total, { page, limit }) {
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

module.exports = {
  asyncHandler,
  hashToken,
  randomToken,
  escapeRegex,
  localDateKey,
  startOfDay,
  endOfDay,
  addDays,
  resolveRange,
  paginate,
  pageMeta,
  round2,
};
