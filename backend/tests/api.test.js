/**
 * End-to-end API tests.
 * Requires a running MongoDB (use a throw-away database!):
 *   TEST_MONGO_URI=mongodb://127.0.0.1:27017/clubspace_test npm test
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_clubspace_suite';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const { connectDB } = require('../src/config/db');
const { User, Member, MembershipPlan, Subscription } = require('../src/models');
const { verifyCheckoutSignature } = require('../src/services/payment.service');
const { expireMemberships, sendExpiryReminders } = require('../src/services/scheduler.service');

const URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/clubspace_test';
const api = request(app);
const tokens = {};
const ctx = {};

const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

before(async () => {
  await connectDB(URI);
  await mongoose.connection.db.dropDatabase();
  await User.create({ name: 'Root', email: 'root@test.dev', password: 'Root@12345', role: 'superadmin', isEmailVerified: true });
  await MembershipPlan.create([
    { name: 'Monthly', code: 'M1', durationType: 'monthly', durationDays: 30, price: 1000, taxPercent: 18 },
    { name: 'Annual', code: 'A1', durationType: 'annual', durationDays: 365, price: 9000 },
  ]);
});

after(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe('Health & authentication', () => {
  test('health check', async () => {
    const r = await api.get('/api/health');
    assert.equal(r.status, 200);
  });

  test('super admin logs in', async () => {
    const r = await api.post('/api/auth/login').send({ email: 'root@test.dev', password: 'Root@12345' });
    assert.equal(r.status, 200, r.body.message);
    tokens.superadmin = r.body.data.token;
  });

  test('wrong password is rejected', async () => {
    const r = await api.post('/api/auth/login').send({ email: 'root@test.dev', password: 'nope12345' });
    assert.equal(r.status, 401);
  });

  test('registration validates input', async () => {
    const r = await api.post('/api/auth/register').send({ firstName: '', email: 'bad', phone: '1', password: 'short' });
    assert.equal(r.status, 422);
    assert.ok(r.body.errors.length >= 3);
  });

  test('member registers, gets membership ID and token', async () => {
    const r = await api.post('/api/auth/register').send({ firstName: 'Asha', lastName: 'Rao', email: 'asha@test.dev', phone: '9876543210', password: 'Secret123' });
    assert.equal(r.status, 201, r.body.message);
    assert.match(r.body.data.member.membershipId, /^CS-\d{4}-\d{5}$/);
    assert.equal(r.body.data.member.status, 'pending');
    tokens.member = r.body.data.token;
    ctx.memberId = r.body.data.member._id;
    ctx.verifyUrl = r.body.data.devVerifyUrl;
    assert.ok(ctx.verifyUrl, 'dev verify url returned when SMTP not configured');
  });

  test('duplicate email is rejected', async () => {
    const r = await api.post('/api/auth/register').send({ firstName: 'X', email: 'asha@test.dev', phone: '9876543211', password: 'Secret123' });
    assert.equal(r.status, 409);
  });

  test('email verification', async () => {
    const token = ctx.verifyUrl.split('/').pop();
    const r = await api.get(`/api/auth/verify-email/${token}`);
    assert.equal(r.status, 200);
    const u = await User.findOne({ email: 'asha@test.dev' });
    assert.equal(u.isEmailVerified, true);
  });

  test('forgot + reset password, old token invalidated', async () => {
    const f = await api.post('/api/auth/forgot-password').send({ email: 'asha@test.dev' });
    assert.equal(f.status, 200);
    const token = f.body.devResetUrl.split('/').pop();
    // unknown emails get the same response
    const f2 = await api.post('/api/auth/forgot-password').send({ email: 'nobody@test.dev' });
    assert.equal(f2.status, 200);
    assert.equal(f2.body.devResetUrl, undefined);

    const r = await api.post(`/api/auth/reset-password/${token}`).send({ password: 'NewSecret456' });
    assert.equal(r.status, 200, r.body.message);
    const old = await api.get('/api/auth/me').set(auth('member'));
    assert.equal(old.status, 401, 'token issued before reset must be rejected');
    const l = await api.post('/api/auth/login').send({ email: 'asha@test.dev', password: 'NewSecret456' });
    assert.equal(l.status, 200);
    tokens.member = l.body.data.token;
  });

  test('protected route without token → 401', async () => {
    const r = await api.get('/api/members');
    assert.equal(r.status, 401);
  });
});

describe('User management & role-based access', () => {
  test('super admin creates admin and staff', async () => {
    for (const role of ['admin', 'staff']) {
      // eslint-disable-next-line no-await-in-loop
      const r = await api.post('/api/users').set(auth('superadmin')).send({ name: `${role} user`, email: `${role}@test.dev`, password: 'Passw0rd!', role });
      assert.equal(r.status, 201, r.body.message);
      // eslint-disable-next-line no-await-in-loop
      const l = await api.post('/api/auth/login').send({ email: `${role}@test.dev`, password: 'Passw0rd!' });
      tokens[role] = l.body.data.token;
    }
  });

  test('admin cannot create another admin', async () => {
    const r = await api.post('/api/users').set(auth('admin')).send({ name: 'Bad', email: 'x@test.dev', password: 'Passw0rd!', role: 'admin' });
    assert.equal(r.status, 403);
  });

  test('member cannot list members', async () => {
    const r = await api.get('/api/members').set(auth('member'));
    assert.equal(r.status, 403);
  });

  test('staff cannot create plans', async () => {
    const r = await api.post('/api/plans').set(auth('staff')).send({ name: 'X', code: 'X', durationType: 'monthly', price: 10 });
    assert.equal(r.status, 403);
  });

  test('admin creates a custom plan', async () => {
    const r = await api.post('/api/plans').set(auth('admin')).send({ name: 'Weekend Pass', code: 'WKND', durationType: 'custom', durationDays: 14, price: 300, features: ['Weekends only'] });
    assert.equal(r.status, 201, r.body.message);
    assert.equal(r.body.data.durationDays, 14);
    ctx.customPlanId = r.body.data._id;
  });

  test('member sees only active plans', async () => {
    await api.patch(`/api/plans/${ctx.customPlanId}`).set(auth('admin')).send({ isActive: false });
    const r = await api.get('/api/plans').set(auth('member'));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.every((p) => p.isActive));
    assert.equal(r.body.data.length, 2);
  });

  test('member can view own record but not someone else\'s', async () => {
    const own = await api.get(`/api/members/${ctx.memberId}`).set(auth('member'));
    assert.equal(own.status, 200);
    const other = await Member.create({ membershipId: 'CS-TEST-1', firstName: 'Other', email: 'o@test.dev', phone: '9999999999' });
    const r = await api.get(`/api/members/${other._id}`).set(auth('member'));
    assert.equal(r.status, 403);
    ctx.otherId = String(other._id);
  });

  test('NoSQL injection in login is neutralised', async () => {
    const r = await api.post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    assert.ok([401, 422].includes(r.status));
  });
});

describe('Members, subscriptions & payments', () => {
  test('staff creates a member with a pending plan', async () => {
    const plans = (await api.get('/api/plans').set(auth('staff'))).body.data;
    ctx.monthly = plans.find((p) => p.code === 'M1');
    ctx.annual = plans.find((p) => p.code === 'A1');
    const r = await api.post('/api/members').set(auth('staff')).send({
      firstName: 'Ravi', lastName: 'K', email: 'ravi@test.dev', phone: '9123456789', planId: ctx.annual._id, createLogin: true, password: 'Ravi12345',
    });
    assert.equal(r.status, 201, r.body.message);
    assert.equal(r.body.data.subscription.status, 'pending');
    ctx.raviId = r.body.data.member._id;
    ctx.raviSub = r.body.data.subscription._id;
  });

  test('search and filter members', async () => {
    const r = await api.get('/api/members?q=ravi&status=pending').set(auth('staff'));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.meta.total, 1);
  });

  test('member buys a plan online (demo Razorpay) → membership active', async () => {
    const s = await api.post('/api/subscriptions').set(auth('member')).send({ planId: ctx.monthly._id });
    assert.equal(s.status, 201, s.body.message);
    assert.equal(s.body.data.subscription.amount, 1180); // 1000 + 18% tax
    const o = await api.post('/api/payments/order').set(auth('member')).send({ subscriptionId: s.body.data.subscription._id });
    assert.equal(o.status, 201, o.body.message);
    assert.equal(o.body.data.order.amount, 118000); // paise
    assert.equal(o.body.data.demoMode, true);
    const d = await api.post('/api/payments/demo/complete').set(auth('member')).send({ paymentId: o.body.data.paymentId });
    assert.equal(d.status, 200, d.body.message);
    assert.equal(d.body.data.status, 'paid');
    assert.match(d.body.data.receiptNo, /^RCPT-\d{4}-\d{6}$/);
    ctx.memberPaymentId = d.body.data._id;

    const me = await Member.findById(ctx.memberId);
    assert.equal(me.status, 'active');
    const days = Math.round((me.membershipExpiry - new Date()) / 864e5);
    assert.ok(days >= 29 && days <= 30);
  });

  test('completing the same payment twice is idempotent', async () => {
    const d = await api.post('/api/payments/demo/complete').set(auth('member')).send({ paymentId: ctx.memberPaymentId });
    assert.equal(d.status, 200);
    const subs = await Subscription.find({ member: ctx.memberId, status: 'active' });
    assert.equal(subs.length, 1);
  });

  test('renewal before expiry stacks the remaining days', async () => {
    const before = (await Member.findById(ctx.memberId)).membershipExpiry;
    const s = await api.post('/api/subscriptions').set(auth('member')).send({ planId: ctx.monthly._id });
    assert.equal(s.body.data.subscription.type, 'renewal');
    const o = await api.post('/api/payments/order').set(auth('member')).send({ subscriptionId: s.body.data.subscription._id });
    await api.post('/api/payments/demo/complete').set(auth('member')).send({ paymentId: o.body.data.paymentId });
    const after = (await Member.findById(ctx.memberId)).membershipExpiry;
    assert.equal(Math.round((after - before) / 864e5), 30);
  });

  test('member cannot pay for another member\'s subscription', async () => {
    const r = await api.post('/api/payments/order').set(auth('member')).send({ subscriptionId: ctx.raviSub });
    assert.equal(r.status, 403);
  });

  test('staff records a cash payment for the pending subscription', async () => {
    const r = await api.post('/api/payments/offline').set(auth('staff')).send({ subscriptionId: ctx.raviSub, method: 'cash', referenceNo: 'CASH-001' });
    assert.equal(r.status, 201, r.body.message);
    assert.equal(r.body.data.status, 'paid');
    ctx.raviPaymentId = r.body.data._id;
    const m = await Member.findById(ctx.raviId);
    assert.equal(m.status, 'active');
  });

  test('Razorpay signature verification (HMAC SHA256)', () => {
    const secret = 'rzp_test_secret';
    const signature = crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
    assert.equal(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature, secret }), true);
    assert.equal(verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_2', signature, secret }), false);
  });

  test('forged verify call is rejected', async () => {
    const s = await api.post('/api/subscriptions').set(auth('member')).send({ planId: ctx.monthly._id });
    const o = await api.post('/api/payments/order').set(auth('member')).send({ subscriptionId: s.body.data.subscription._id });
    const r = await api.post('/api/payments/verify').set(auth('member')).send({
      paymentId: o.body.data.paymentId, razorpay_order_id: o.body.data.order.id, razorpay_payment_id: 'pay_fake', razorpay_signature: 'deadbeef',
    });
    assert.equal(r.status, 400);
  });

  test('receipt PDF downloads', async () => {
    const r = await api.get(`/api/payments/${ctx.memberPaymentId}/receipt`).set(auth('member')).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'application/pdf');
    assert.equal(r.body.subarray(0, 4).toString(), '%PDF');
  });

  test('member sees only own payments', async () => {
    const r = await api.get('/api/payments').set(auth('member'));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.every((p) => String(p.member._id) === String(ctx.memberId)));
  });

  test('pending payments filter', async () => {
    const r = await api.get('/api/payments?status=pending').set(auth('admin'));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.every((p) => ['created', 'pending'].includes(p.status)));
  });

  test('staff cannot refund; admin full refund cancels the membership', async () => {
    const s = await api.post(`/api/payments/${ctx.raviPaymentId}/refund`).set(auth('staff')).send({ reason: 'test' });
    assert.equal(s.status, 403);
    const r = await api.post(`/api/payments/${ctx.raviPaymentId}/refund`).set(auth('admin')).send({ reason: 'Member relocated' });
    assert.equal(r.status, 200, r.body.message);
    assert.equal(r.body.data.status, 'refunded');
    const m = await Member.findById(ctx.raviId);
    assert.equal(m.status, 'expired');
    const ledger = await api.get('/api/payments/transactions/ledger?type=debit').set(auth('admin'));
    assert.equal(ledger.body.data.length, 1);
  });

  test('partial refund', async () => {
    const r = await api.post('/api/payments/offline').set(auth('admin')).send({ memberId: ctx.raviId, planId: ctx.monthly._id, method: 'upi', referenceNo: 'UPI123' });
    assert.equal(r.status, 201, r.body.message);
    const p = await api.post(`/api/payments/${r.body.data._id}/refund`).set(auth('admin')).send({ amount: 100, reason: 'Discount' });
    assert.equal(p.body.data.status, 'partially_refunded');
    const over = await api.post(`/api/payments/${r.body.data._id}/refund`).set(auth('admin')).send({ amount: 999999, reason: 'x' });
    assert.equal(over.status, 400);
  });

  test('membership history', async () => {
    const r = await api.get(`/api/members/${ctx.memberId}/subscriptions`).set(auth('member'));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.length >= 2);
  });
});

describe('Attendance', () => {
  test('member QR code is generated', async () => {
    const r = await api.get(`/api/members/${ctx.memberId}/qr`).set(auth('member'));
    assert.equal(r.status, 200);
    assert.match(r.body.data.dataUrl, /^data:image\/png;base64,/);
  });

  test('QR scan checks in, second scan checks out', async () => {
    const m = await Member.findById(ctx.memberId);
    const a = await api.post('/api/attendance/scan').set(auth('staff')).send({ code: `CLUBSPACE:${m.qrToken}` });
    assert.equal(a.status, 200, a.body.message);
    assert.equal(a.body.data.action, 'check-in');
    assert.equal(a.body.data.record.method, 'qr');
    const b = await api.post('/api/attendance/scan').set(auth('staff')).send({ code: m.membershipId });
    assert.equal(b.body.data.action, 'check-out');
    assert.ok(b.body.data.record.durationMinutes >= 1);
  });

  test('manual check-in / check-out', async () => {
    const m = await Member.findById(ctx.memberId);
    const a = await api.post('/api/attendance/check-in').set(auth('staff')).send({ memberId: m._id });
    assert.equal(a.status, 201, a.body.message);
    const dup = await api.post('/api/attendance/check-in').set(auth('staff')).send({ memberId: m._id });
    assert.equal(dup.status, 400);
    const b = await api.post('/api/attendance/check-out').set(auth('staff')).send({ memberId: m._id });
    assert.equal(b.status, 200);
  });

  test('expired members are refused entry', async () => {
    const r = await api.post('/api/attendance/check-in').set(auth('staff')).send({ memberId: ctx.otherId });
    assert.equal(r.status, 400);
  });

  test('daily attendance list and summary', async () => {
    const r = await api.get('/api/attendance').set(auth('staff'));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 2);
    const s = await api.get('/api/attendance/summary').set(auth('staff'));
    assert.equal(s.body.data.todayCount, 2);
    const mine = await api.get('/api/attendance').set(auth('member'));
    assert.equal(mine.body.data.length, 2);
  });
});

describe('Events', () => {
  test('admin creates free and paid events', async () => {
    const start = new Date(Date.now() + 5 * 864e5).toISOString();
    const end = new Date(Date.now() + 5.2 * 864e5).toISOString();
    const free = await api.post('/api/events').set(auth('admin')).send({ title: 'Yoga', startDate: start, endDate: end, capacity: 1 });
    assert.equal(free.status, 201, free.body.message);
    const paid = await api.post('/api/events').set(auth('admin')).send({ title: 'Tournament', startDate: start, endDate: end, fee: 250 });
    ctx.freeEvent = free.body.data._id;
    ctx.paidEvent = paid.body.data._id;
    const bad = await api.post('/api/events').set(auth('admin')).send({ title: 'Bad', startDate: end, endDate: start });
    assert.equal(bad.status, 422);
  });

  test('member registers for a free event; capacity enforced', async () => {
    const r = await api.post(`/api/events/${ctx.freeEvent}/register`).set(auth('member'));
    assert.equal(r.status, 201, r.body.message);
    assert.equal(r.body.data.status, 'registered');
    const again = await api.post(`/api/events/${ctx.freeEvent}/register`).set(auth('member'));
    assert.equal(again.status, 409);
    const full = await api.post(`/api/events/${ctx.freeEvent}/register`).set(auth('admin')).send({ memberId: ctx.raviId });
    assert.equal(full.status, 400); // Ravi expired (members only) or event full
  });

  test('paid event: register → pay → registered', async () => {
    const r = await api.post(`/api/events/${ctx.paidEvent}/register`).set(auth('member'));
    assert.equal(r.body.data.status, 'pending_payment');
    const o = await api.post('/api/payments/order').set(auth('member')).send({ eventId: ctx.paidEvent });
    assert.equal(o.status, 201, o.body.message);
    await api.post('/api/payments/demo/complete').set(auth('member')).send({ paymentId: o.body.data.paymentId });
    const ev = await api.get(`/api/events/${ctx.paidEvent}`).set(auth('member'));
    assert.equal(ev.body.data.myRegistration.status, 'registered');
    assert.equal(ev.body.data.participants, undefined, 'members do not see participant list');
    const adminView = await api.get(`/api/events/${ctx.paidEvent}`).set(auth('admin'));
    assert.equal(adminView.body.data.participants.length, 1);
  });
});

describe('Dashboards, notifications, reports, settings', () => {
  test('admin dashboard stats', async () => {
    const r = await api.get('/api/dashboard/admin').set(auth('admin'));
    assert.equal(r.status, 200, r.body.message);
    const c = r.body.data.cards;
    assert.ok(c.totalMembers >= 3);
    assert.ok(c.activeMembers >= 1);
    assert.ok(c.totalRevenue > 0);
    assert.equal(r.body.data.monthlyRevenue.length, 12);
  });

  test('member and staff dashboards', async () => {
    const m = await api.get('/api/dashboard/member').set(auth('member'));
    assert.equal(m.status, 200, m.body.message);
    assert.ok(m.body.data.daysLeft >= 59);
    const s = await api.get('/api/dashboard/staff').set(auth('staff'));
    assert.equal(s.status, 200);
    const forbidden = await api.get('/api/dashboard/admin').set(auth('staff'));
    assert.equal(forbidden.status, 403);
  });

  test('member has in-app notifications and can mark them read', async () => {
    const r = await api.get('/api/notifications').set(auth('member'));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.some((n) => n.type === 'payment_confirmation'));
    assert.ok(r.body.meta.unread > 0);
    await api.patch('/api/notifications/read-all').set(auth('member'));
    const after = await api.get('/api/notifications').set(auth('member'));
    assert.equal(after.body.meta.unread, 0);
  });

  test('admin broadcast', async () => {
    const r = await api.post('/api/notifications/broadcast').set(auth('admin')).send({ title: 'Pool closed', message: 'Maintenance on Sunday', audience: 'active' });
    assert.equal(r.status, 200, r.body.message);
    assert.ok(r.body.data.count >= 1);
  });

  test('expiry job marks members expired and reminders are sent once', async () => {
    const m = await Member.create({ membershipId: 'CS-TEST-2', firstName: 'Late', email: 'late@test.dev', phone: '9000011111', status: 'active', membershipExpiry: new Date(Date.now() - 864e5) });
    const res = await expireMemberships();
    assert.ok(res.membersExpired >= 1);
    assert.equal((await Member.findById(m._id)).status, 'expired');

    const soon = new Date(Date.now() + 3 * 864e5);
    const m2 = await Member.create({ membershipId: 'CS-TEST-3', firstName: 'Soon', email: 'soon@test.dev', phone: '9000022222', status: 'active', membershipExpiry: soon });
    await Subscription.create({ member: m2._id, plan: ctx.monthly._id, amount: 1, status: 'active', startDate: new Date(), endDate: soon, planSnapshot: { name: 'Monthly', durationDays: 30 } });
    const r1 = await sendExpiryReminders();
    const r2 = await sendExpiryReminders();
    assert.ok(r1.remindersSent >= 1);
    assert.equal(r2.remindersSent, 0);
  });

  for (const type of ['members', 'payments', 'revenue', 'attendance', 'subscriptions', 'summary']) {
    test(`report: ${type} (json, xlsx, pdf)`, async () => {
      const j = await api.get(`/api/reports/${type}?period=monthly`).set(auth('admin'));
      assert.equal(j.status, 200, j.body.message);
      assert.ok(Array.isArray(j.body.data.rows));
      const binary = (res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      };
      const x = await api.get(`/api/reports/${type}?period=annual&format=xlsx`).set(auth('admin')).buffer(true).parse(binary);
      assert.equal(x.status, 200);
      assert.equal(x.body.subarray(0, 2).toString(), 'PK');
      const p = await api.get(`/api/reports/${type}?period=daily&format=pdf`).set(auth('admin')).buffer(true).parse(binary);
      assert.equal(p.body.subarray(0, 4).toString(), '%PDF');
    });
  }

  test('staff cannot access reports', async () => {
    const r = await api.get('/api/reports/revenue').set(auth('staff'));
    assert.equal(r.status, 403);
  });

  test('settings: admin reads, only super admin updates', async () => {
    const g = await api.get('/api/settings').set(auth('admin'));
    assert.equal(g.status, 200);
    const denied = await api.patch('/api/settings').set(auth('admin')).send({ clubName: 'X' });
    assert.equal(denied.status, 403);
    const ok = await api.patch('/api/settings').set(auth('superadmin')).send({ clubName: 'Riverside Club', reminderDaysBefore: '10,5,1' });
    assert.equal(ok.status, 200, ok.body.message);
    assert.deepEqual(ok.body.data.reminderDaysBefore, [10, 5, 1]);
    const pub = await api.get('/api/settings/public');
    assert.equal(pub.body.data.clubName, 'Riverside Club');
  });

  test('deactivated user loses access', async () => {
    const staff = await User.findOne({ email: 'staff@test.dev' });
    await api.patch(`/api/users/${staff._id}`).set(auth('admin')).send({ isActive: false });
    const r = await api.get('/api/dashboard/staff').set(auth('staff'));
    assert.equal(r.status, 403);
  });

  test('unknown route → 404 JSON', async () => {
    const r = await api.get('/api/nope');
    assert.equal(r.status, 404);
    assert.equal(r.body.success, false);
  });
});
