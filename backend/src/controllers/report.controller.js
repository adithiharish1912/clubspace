const { Member, Payment, Attendance, Subscription, Event, Setting, Transaction } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, resolveRange, localDateKey, round2 } = require('../utils/helpers');
const { tablePdf, fmtDate } = require('../services/pdf.service');
const { tableXlsx } = require('../services/excel.service');

const PAID = ['paid', 'partially_refunded', 'refunded'];
const inr = (n) => round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const name = (m) => (m ? `${m.firstName} ${m.lastName || ''}`.trim() : '-');

const builders = {
  async members({ from, to, query }) {
    const filter = { createdAt: { $gte: from, $lte: to } };
    if (query.status) filter.status = query.status;
    if (query.all === 'true') delete filter.createdAt;
    const members = await Member.find(filter).sort('membershipId').populate('currentSubscription', 'planSnapshot').lean();
    const count = (s) => members.filter((m) => m.status === s).length;
    return {
      title: 'Member Report',
      columns: [
        { header: 'Member ID', key: 'membershipId', width: 1.2 },
        { header: 'Name', key: 'name', width: 1.6 },
        { header: 'Email', key: 'email', width: 2 },
        { header: 'Phone', key: 'phone', width: 1.1 },
        { header: 'Plan', key: 'plan', width: 1.2 },
        { header: 'Status', key: 'status', width: 0.9 },
        { header: 'Joined', key: 'joined', width: 1 },
        { header: 'Expiry', key: 'expiry', width: 1 },
      ],
      rows: members.map((m) => ({
        membershipId: m.membershipId,
        name: name(m),
        email: m.email,
        phone: m.phone,
        plan: m.currentSubscription?.planSnapshot?.name || '-',
        status: m.status,
        joined: fmtDate(m.joinedAt || m.createdAt),
        expiry: fmtDate(m.membershipExpiry),
      })),
      summary: [
        ['Members', members.length],
        ['Active', count('active')],
        ['Pending', count('pending')],
        ['Expired', count('expired')],
      ],
    };
  },

  async payments({ from, to, query }) {
    const filter = { createdAt: { $gte: from, $lte: to } };
    if (query.status) filter.status = query.status;
    if (query.method) filter.method = query.method;
    const payments = await Payment.find(filter).sort('-createdAt').populate('member', 'firstName lastName membershipId').lean();
    const paid = payments.filter((p) => PAID.includes(p.status));
    const gross = paid.reduce((s, p) => s + p.amount, 0);
    const refunded = paid.reduce((s, p) => s + (p.refundedAmount || 0), 0);
    return {
      title: 'Payment Report',
      columns: [
        { header: 'Date', key: 'date', width: 1 },
        { header: 'Receipt No', key: 'receiptNo', width: 1.4 },
        { header: 'Member', key: 'member', width: 1.5 },
        { header: 'Member ID', key: 'membershipId', width: 1.2 },
        { header: 'Description', key: 'description', width: 2 },
        { header: 'Method', key: 'method', width: 0.9 },
        { header: 'Status', key: 'status', width: 1.1 },
        { header: 'Amount', key: 'amount', width: 0.9, align: 'right' },
        { header: 'Refunded', key: 'refunded', width: 0.9, align: 'right' },
      ],
      rows: payments.map((p) => ({
        date: fmtDate(p.paidAt || p.createdAt),
        receiptNo: p.receiptNo || '-',
        member: name(p.member),
        membershipId: p.member?.membershipId,
        description: p.description,
        method: p.method,
        status: p.status,
        amount: round2(p.amount),
        refunded: round2(p.refundedAmount || 0),
      })),
      summary: [
        ['Transactions', payments.length],
        ['Successful', paid.length],
        ['Gross (Rs.)', inr(gross)],
        ['Net (Rs.)', inr(gross - refunded)],
      ],
    };
  },

  async revenue({ from, to, period }) {
    const [payments, refunds] = await Promise.all([
      Payment.find({ status: { $in: PAID }, paidAt: { $gte: from, $lte: to } }).lean(),
      Transaction.find({ type: 'debit', createdAt: { $gte: from, $lte: to } }).lean(),
    ]);
    const byMonth = period === 'annual';
    const bucket = (d) => (byMonth ? localDateKey(d).slice(0, 7) : localDateKey(d));
    const rows = {};
    const touch = (k) => {
      rows[k] = rows[k] || { period: k, count: 0, membership: 0, event: 0, gross: 0, refunds: 0 };
      return rows[k];
    };
    const methods = {};
    payments.forEach((p) => {
      const r = touch(bucket(new Date(p.paidAt)));
      r.count += 1;
      r.gross += p.amount;
      if (p.purpose === 'event') r.event += p.amount;
      else r.membership += p.amount;
      methods[p.method] = (methods[p.method] || 0) + p.amount;
    });
    refunds.forEach((t) => {
      touch(bucket(new Date(t.createdAt))).refunds += t.amount;
    });
    const list = Object.values(rows)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((r) => ({ ...r, membership: round2(r.membership), event: round2(r.event), gross: round2(r.gross), refunds: round2(r.refunds), net: round2(r.gross - r.refunds) }));
    const gross = list.reduce((s, r) => s + r.gross, 0);
    const ref = list.reduce((s, r) => s + r.refunds, 0);
    return {
      title: 'Revenue Report',
      columns: [
        { header: byMonth ? 'Month' : 'Date', key: 'period', width: 1 },
        { header: 'Payments', key: 'count', width: 0.8, align: 'right' },
        { header: 'Membership', key: 'membership', width: 1, align: 'right' },
        { header: 'Events', key: 'event', width: 1, align: 'right' },
        { header: 'Gross', key: 'gross', width: 1, align: 'right' },
        { header: 'Refunds', key: 'refunds', width: 1, align: 'right' },
        { header: 'Net', key: 'net', width: 1, align: 'right' },
      ],
      rows: list,
      summary: [
        ['Gross (Rs.)', inr(gross)],
        ['Refunds (Rs.)', inr(ref)],
        ['Net (Rs.)', inr(gross - ref)],
        ['Payments', payments.length],
        ...Object.entries(methods).map(([k, v]) => [`Via ${k} (Rs.)`, inr(v)]),
      ],
    };
  },

  async attendance({ from, to, query }) {
    const filter = { date: { $gte: localDateKey(from), $lte: localDateKey(to) } };
    if (query.member) filter.member = query.member;
    const recs = await Attendance.find(filter).sort('-checkIn').populate('member', 'firstName lastName membershipId').lean();
    const unique = new Set(recs.map((r) => String(r.member?._id)));
    const withDur = recs.filter((r) => r.durationMinutes);
    const avg = withDur.length ? Math.round(withDur.reduce((s, r) => s + r.durationMinutes, 0) / withDur.length) : 0;
    const t = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-');
    return {
      title: 'Attendance Report',
      columns: [
        { header: 'Date', key: 'date', width: 1 },
        { header: 'Member ID', key: 'membershipId', width: 1.2 },
        { header: 'Name', key: 'name', width: 1.6 },
        { header: 'Check-in', key: 'checkIn', width: 0.9 },
        { header: 'Check-out', key: 'checkOut', width: 0.9 },
        { header: 'Minutes', key: 'duration', width: 0.8, align: 'right' },
        { header: 'Method', key: 'method', width: 0.8 },
      ],
      rows: recs.map((r) => ({
        date: r.date,
        membershipId: r.member?.membershipId,
        name: name(r.member),
        checkIn: t(r.checkIn),
        checkOut: t(r.checkOut),
        duration: r.durationMinutes || '-',
        method: r.method,
      })),
      summary: [
        ['Visits', recs.length],
        ['Unique members', unique.size],
        ['Avg. minutes', avg],
      ],
    };
  },

  async subscriptions({ from, to, query }) {
    const filter = { createdAt: { $gte: from, $lte: to } };
    if (query.status) filter.status = query.status;
    const subs = await Subscription.find(filter).sort('-createdAt').populate('member', 'firstName lastName membershipId').lean();
    return {
      title: 'Membership Report',
      columns: [
        { header: 'Created', key: 'created', width: 1 },
        { header: 'Member ID', key: 'membershipId', width: 1.2 },
        { header: 'Name', key: 'name', width: 1.5 },
        { header: 'Plan', key: 'plan', width: 1.3 },
        { header: 'Type', key: 'type', width: 0.8 },
        { header: 'Status', key: 'status', width: 0.9 },
        { header: 'Start', key: 'start', width: 1 },
        { header: 'End', key: 'end', width: 1 },
        { header: 'Amount', key: 'amount', width: 0.9, align: 'right' },
      ],
      rows: subs.map((s) => ({
        created: fmtDate(s.createdAt),
        membershipId: s.member?.membershipId,
        name: name(s.member),
        plan: s.planSnapshot?.name,
        type: s.type,
        status: s.status,
        start: fmtDate(s.startDate),
        end: fmtDate(s.endDate),
        amount: round2(s.amount),
      })),
      summary: [
        ['Subscriptions', subs.length],
        ['New', subs.filter((s) => s.type === 'new').length],
        ['Renewals', subs.filter((s) => s.type === 'renewal').length],
        ['Pending payment', subs.filter((s) => s.status === 'pending').length],
      ],
    };
  },

  // Daily / monthly / annual overview of the whole club
  async summary(ctx) {
    const { from, to, period } = ctx;
    const [rev, newMembers, renewals, visits, events, active] = await Promise.all([
      builders.revenue(ctx),
      Member.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      Subscription.countDocuments({ type: 'renewal', status: { $in: ['active', 'expired'] }, startDate: { $gte: from, $lte: to } }),
      Attendance.countDocuments({ date: { $gte: localDateKey(from), $lte: localDateKey(to) } }),
      Event.countDocuments({ startDate: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } }),
      Member.countDocuments({ status: 'active' }),
    ]);
    const label = { daily: 'Daily', monthly: 'Monthly', annual: 'Annual' }[period] || 'Period';
    return {
      ...rev,
      title: `${label} Report`,
      summary: [
        ['New members', newMembers],
        ['Renewals', renewals],
        ['Active members now', active],
        ['Visits', visits],
        ['Events', events],
        ...rev.summary.slice(0, 3),
      ],
    };
  },
};

// GET /api/reports/:type?period=daily|monthly|annual|custom&date=&from=&to=&format=json|xlsx|pdf
exports.generate = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const builder = builders[type];
  if (!builder) throw ApiError.notFound(`Unknown report type "${type}"`);
  const period = req.query.period || 'custom';
  const { from, to } = resolveRange({ ...req.query, period });
  if (from > to) throw ApiError.badRequest('"from" must be before "to"');

  const report = await builder({ from, to, period, query: req.query });
  const subtitle = `Period: ${fmtDate(from)} – ${fmtDate(to)}`;
  const format = req.query.format || 'json';
  const fileBase = `${type}-report-${localDateKey(from)}_${localDateKey(to)}`;

  if (format === 'xlsx') {
    const buf = await tableXlsx(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  if (format === 'pdf') {
    const settings = await Setting.get();
    const buf = await tablePdf({ ...report, subtitle, settings });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.pdf"`);
    return res.send(buf);
  }
  return res.json({ success: true, data: { ...report, subtitle, from, to } });
});
