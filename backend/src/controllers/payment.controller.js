const crypto = require('crypto');
const env = require('../config/env');
const { razorpay, isRazorpayConfigured, isDemoPaymentMode } = require('../config/razorpay');
const { Payment, Subscription, Member, Event, Transaction, Setting } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, paginate, pageMeta, resolveRange, escapeRegex, round2 } = require('../utils/helpers');
const { isStaffOrAbove, assertMemberAccess } = require('../middleware/auth');
const { verifyCheckoutSignature, verifyWebhookSignature, completePayment, completeFreeSubscription } = require('../services/payment.service');
const { createPendingSubscription } = require('../services/membership.service');
const { receiptPdf, money } = require('../services/pdf.service');
const { notify } = require('../services/notification.service');

// GET /api/payments/config
exports.config = asyncHandler(async (_req, res) => {
  const settings = await Setting.get();
  res.json({
    success: true,
    data: {
      keyId: isRazorpayConfigured ? env.razorpay.keyId : null,
      demoMode: isDemoPaymentMode,
      enabled: isRazorpayConfigured || isDemoPaymentMode,
      currency: settings.currency,
      clubName: settings.clubName,
    },
  });
});

async function buildPaymentFor(req) {
  const { subscriptionId, eventId } = req.body;
  if (subscriptionId) {
    const sub = await Subscription.findById(subscriptionId);
    if (!sub) throw ApiError.notFound('Subscription not found');
    assertMemberAccess(req, sub.member);
    if (sub.status !== 'pending') throw ApiError.badRequest('This subscription is not awaiting payment');
    return {
      member: sub.member,
      subscription: sub._id,
      purpose: 'membership',
      amount: sub.amount,
      description: `${sub.planSnapshot.name} membership (${sub.type === 'renewal' ? 'renewal' : 'new'})${
        sub.coupon?.code ? ` – coupon ${sub.coupon.code}: ${sub.coupon.label}` : ''
      }`,
    };
  }
  if (eventId) {
    const event = await Event.findById(eventId);
    if (!event) throw ApiError.notFound('Event not found');
    const memberId = isStaffOrAbove(req.user) ? req.body.memberId : req.member?._id;
    if (!memberId) throw ApiError.badRequest('memberId is required');
    const p = event.participants.find((x) => String(x.member) === String(memberId) && x.status === 'pending_payment');
    if (!p) throw ApiError.badRequest('Register for the event first');
    return { member: memberId, event: event._id, purpose: 'event', amount: event.fee, description: `Event: ${event.title}` };
  }
  throw ApiError.badRequest('subscriptionId or eventId is required');
}

// POST /api/payments/order – creates a Razorpay order (or a demo order)
exports.createOrder = asyncHandler(async (req, res) => {
  if (!isRazorpayConfigured && !isDemoPaymentMode) {
    throw ApiError.badRequest(
      'Online payment is not accepted due to high value. Kindly contact the club admin or adithiharish1912@gmail.com to complete your payment.'
    );
  }
  const data = await buildPaymentFor(req);
  if (data.amount <= 0) throw ApiError.badRequest('Nothing to pay');
  const settings = await Setting.get();

  const payment = await Payment.create({ ...data, currency: settings.currency, method: isRazorpayConfigured ? 'razorpay' : 'demo', status: 'created' });

  let order;
  if (isRazorpayConfigured) {
    order = await razorpay.orders.create({
      amount: Math.round(data.amount * 100),
      currency: settings.currency,
      receipt: String(payment._id),
      notes: { paymentId: String(payment._id), purpose: data.purpose },
    });
  } else {
    order = { id: `order_demo_${crypto.randomBytes(8).toString('hex')}`, amount: Math.round(data.amount * 100), currency: settings.currency };
  }
  payment.razorpayOrderId = order.id;
  await payment.save();

  const member = await Member.findById(data.member);
  res.status(201).json({
    success: true,
    data: {
      paymentId: payment._id,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      keyId: isRazorpayConfigured ? env.razorpay.keyId : null,
      demoMode: !isRazorpayConfigured,
      description: data.description,
      prefill: { name: member.fullName, email: member.email, contact: member.phone },
      clubName: settings.clubName,
    },
  });
});

// POST /api/payments/verify – called by the frontend after Razorpay Checkout succeeds
exports.verify = asyncHandler(async (req, res) => {
  const { paymentId, razorpay_order_id: orderId, razorpay_payment_id: rpPaymentId, razorpay_signature: signature } = req.body;
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');
  assertMemberAccess(req, payment.member);
  if (payment.razorpayOrderId !== orderId) throw ApiError.badRequest('Order mismatch');
  if (!verifyCheckoutSignature({ orderId, paymentId: rpPaymentId, signature })) {
    payment.status = 'failed';
    payment.failureReason = 'Signature verification failed';
    await payment.save();
    throw ApiError.badRequest('Payment verification failed');
  }
  const done = await completePayment(payment._id, { method: 'razorpay', razorpayPaymentId: rpPaymentId, razorpaySignature: signature });
  res.json({ success: true, message: 'Payment successful', data: done });
});

// POST /api/payments/demo/complete – DEMO MODE ONLY (no Razorpay keys, non-production)
exports.demoComplete = asyncHandler(async (req, res) => {
  if (!isDemoPaymentMode) throw ApiError.forbidden('Demo payments are disabled');
  const payment = await Payment.findById(req.body.paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');
  assertMemberAccess(req, payment.member);
  const done = await completePayment(payment._id, { method: 'demo', razorpayPaymentId: `pay_demo_${crypto.randomBytes(7).toString('hex')}` });
  res.json({ success: true, message: 'Demo payment successful', data: done });
});

// POST /api/payments/:id/failed – checkout dismissed or failed
exports.markFailed = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  assertMemberAccess(req, payment.member);
  if (payment.status === 'created') {
    payment.status = 'failed';
    payment.failureReason = String(req.body.reason || 'Checkout cancelled').slice(0, 300);
    await payment.save();
  }
  res.json({ success: true, data: payment });
});

// POST /api/payments/offline (staff) – cash/UPI/card at the counter
// Body: { subscriptionId } or { memberId, planId } or { eventId, memberId }, method, referenceNo
exports.recordOffline = asyncHandler(async (req, res) => {
  const { method, referenceNo, couponCode } = req.body;
  // A coupon at the counter: (re)create the checkout for that plan with the coupon applied
  if (couponCode && req.body.subscriptionId && !req.body.planId) {
    const existing = await Subscription.findById(req.body.subscriptionId);
    if (!existing || existing.status !== 'pending') throw ApiError.badRequest('This subscription is not awaiting payment');
    req.body.memberId = String(existing.member);
    req.body.planId = String(existing.plan);
    delete req.body.subscriptionId;
  }
  if (!req.body.subscriptionId && req.body.planId) {
    const { subscription } = await createPendingSubscription({
      memberId: req.body.memberId,
      planId: req.body.planId,
      couponCode,
      createdBy: req.user._id,
    });
    if (subscription.amount === 0) {
      const done = await completeFreeSubscription(subscription, { recordedBy: req.user._id });
      return res.status(201).json({ success: true, message: 'Coupon applied – membership activated free', data: done });
    }
    req.body.subscriptionId = subscription._id;
  }
  const data = await buildPaymentFor(req);
  const settings = await Setting.get();
  const payment = await Payment.create({ ...data, currency: settings.currency, method, referenceNo, status: 'pending', recordedBy: req.user._id });
  const done = await completePayment(payment._id, { method, referenceNo, recordedBy: req.user._id });
  return res.status(201).json({ success: true, message: 'Payment recorded', data: done });
});

// GET /api/payments
exports.list = asyncHandler(async (req, res) => {
  const { status, method, purpose, member, q, from, to } = req.query;
  const filter = {};
  if (!isStaffOrAbove(req.user)) filter.member = req.member?._id;
  else if (member) filter.member = member;
  if (status === 'pending') filter.status = { $in: ['created', 'pending'] };
  else if (status) filter.status = status;
  if (method) filter.method = method;
  if (purpose) filter.purpose = purpose;
  if (q) filter.$or = [{ receiptNo: new RegExp(escapeRegex(q), 'i') }, { razorpayPaymentId: q }, { razorpayOrderId: q }];
  if (from || to) {
    const r = resolveRange({ from, to });
    filter.createdAt = { $gte: r.from, $lte: r.to };
  }
  const pg = paginate(req.query);
  const [items, total, sums] = await Promise.all([
    Payment.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).populate('member', 'firstName lastName membershipId email phone'),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: { ...filter, status: { $in: ['paid', 'partially_refunded', 'refunded'] } } }, { $group: { _id: null, gross: { $sum: '$amount' }, refunded: { $sum: '$refundedAmount' } } }]),
  ]);
  const s = sums[0] || { gross: 0, refunded: 0 };
  res.json({ success: true, data: items, meta: { ...pageMeta(total, pg), gross: s.gross, refunded: s.refunded, net: round2(s.gross - s.refunded) } });
});

// GET /api/payments/:id
exports.get = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('member', 'firstName lastName membershipId email phone').populate('subscription').populate('event', 'title startDate');
  if (!payment) throw ApiError.notFound('Payment not found');
  assertMemberAccess(req, payment.member._id);
  res.json({ success: true, data: payment });
});

// GET /api/payments/:id/receipt – PDF
exports.receipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  assertMemberAccess(req, payment.member);
  if (!payment.receiptNo) throw ApiError.badRequest('Receipt is available only for completed payments');
  const [member, settings] = await Promise.all([Member.findById(payment.member), Setting.get()]);
  const pdf = await receiptPdf({ payment, member, settings });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payment.receiptNo}.pdf"`);
  res.send(pdf);
});

// POST /api/payments/:id/refund  (admin) { amount?, reason }
exports.refund = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (!['paid', 'partially_refunded'].includes(payment.status)) throw ApiError.badRequest('Only paid payments can be refunded');
  const refundable = round2(payment.amount - payment.refundedAmount);
  const amount = round2(req.body.amount ?? refundable);
  if (amount <= 0 || amount > refundable) throw ApiError.badRequest(`Refund amount must be between 0 and ${refundable}`);

  let razorpayRefundId;
  if (payment.method === 'razorpay' && isRazorpayConfigured && payment.razorpayPaymentId) {
    const r = await razorpay.payments.refund(payment.razorpayPaymentId, { amount: Math.round(amount * 100), notes: { reason: req.body.reason || '' } });
    razorpayRefundId = r.id;
  }

  payment.refunds.push({ amount, reason: req.body.reason, razorpayRefundId, processedBy: req.user._id });
  payment.refundedAmount = round2(payment.refundedAmount + amount);
  payment.status = payment.refundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';
  await payment.save();

  await Transaction.create({
    payment: payment._id,
    member: payment.member,
    type: 'debit',
    category: 'refund',
    amount,
    method: payment.method,
    reference: razorpayRefundId,
    description: `Refund: ${req.body.reason || payment.description}`,
    performedBy: req.user._id,
  });

  // A full refund of a membership payment cancels that subscription
  if (payment.status === 'refunded' && payment.subscription) {
    await Subscription.updateOne({ _id: payment.subscription }, { status: 'cancelled', cancelledReason: 'Refunded' });
    const member = await Member.findById(payment.member);
    const latest = await Subscription.findOne({ member: member._id, status: 'active' }).sort('-endDate');
    member.membershipExpiry = latest?.endDate;
    member.currentSubscription = latest?._id;
    if (!latest || latest.endDate < new Date()) member.status = 'expired';
    await member.save();
  }
  if (payment.status === 'refunded' && payment.event) {
    const ev = await Event.findById(payment.event);
    const p = ev?.participants.find((x) => String(x.payment) === String(payment._id));
    if (p) {
      p.status = 'cancelled';
      await ev.save();
    }
  }

  const member = await Member.findById(payment.member);
  await notify({
    member,
    type: 'payment_refund',
    title: 'Refund processed',
    message: `A refund of ${money(amount, payment.currency)} for receipt ${payment.receiptNo} has been processed. It may take 5–7 working days to reflect in your account.`,
    link: '/my/payments',
  });
  res.json({ success: true, message: 'Refund processed', data: payment });
});

// GET /api/payments/transactions/ledger  (admin)
exports.transactions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.from || req.query.to) {
    const r = resolveRange(req.query);
    filter.createdAt = { $gte: r.from, $lte: r.to };
  }
  const pg = paginate(req.query);
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).populate('member', 'firstName lastName membershipId').populate('payment', 'receiptNo'),
    Transaction.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, pg) });
});

// POST /api/payments/webhook – Razorpay webhook (raw body, signature verified)
exports.webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!verifyWebhookSignature(req.body, signature)) return res.status(400).json({ success: false, message: 'Invalid signature' });
  const event = JSON.parse(req.body.toString('utf8'));
  const entity = event.payload?.payment?.entity;
  if (entity?.order_id) {
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (payment) {
      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        await completePayment(payment._id, { method: 'razorpay', razorpayPaymentId: entity.id });
      } else if (event.event === 'payment.failed' && payment.status === 'created') {
        payment.status = 'failed';
        payment.failureReason = entity.error_description || 'Payment failed';
        await payment.save();
      }
    }
  }
  return res.json({ success: true });
});
