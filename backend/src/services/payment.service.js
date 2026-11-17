const crypto = require('crypto');
const env = require('../config/env');
const { Payment, Transaction, Member, Event, Setting } = require('../models');
const { generateReceiptNo } = require('./counter.service');
const { activateSubscription } = require('./membership.service');
const { notify } = require('./notification.service');
const { receiptPdf, money } = require('./pdf.service');

/** Verifies the checkout signature returned by Razorpay Checkout. */
function verifyCheckoutSignature({ orderId, paymentId, signature, secret = env.razorpay.keySecret }) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verifies a Razorpay webhook signature (computed over the raw body). */
function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Marks a payment as paid and runs every side effect exactly once:
 * receipt number, ledger entry, subscription activation / event registration,
 * notification with PDF receipt. Idempotent – safe to call from both the
 * client verify call and the webhook.
 */
async function completePayment(paymentId, { method, razorpayPaymentId, razorpaySignature, referenceNo, recordedBy } = {}) {
  // Atomic claim so concurrent verify + webhook cannot both process the payment
  const receiptNo = await generateReceiptNo();
  const claim = await Payment.updateOne(
    { _id: paymentId, status: { $in: ['created', 'pending', 'failed'] } },
    {
      $set: {
        status: 'paid',
        paidAt: new Date(),
        receiptNo,
        ...(method ? { method } : {}),
        ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
        ...(razorpaySignature ? { razorpaySignature } : {}),
        ...(referenceNo ? { referenceNo } : {}),
        ...(recordedBy ? { recordedBy } : {}),
      },
    }
  );
  if (!claim.modifiedCount) return Payment.findById(paymentId); // already processed by another request
  const payment = await Payment.findById(paymentId);

  await Transaction.create({
    payment: payment._id,
    member: payment.member,
    type: 'credit',
    category: payment.purpose === 'event' ? 'event' : 'membership',
    amount: payment.amount,
    method: payment.method,
    reference: payment.razorpayPaymentId || payment.referenceNo,
    description: payment.description,
    performedBy: recordedBy,
  });

  if (payment.subscription) {
    await activateSubscription(payment.subscription, payment._id);
  }
  if (payment.event) {
    const ev = await Event.findById(payment.event);
    const p = ev?.participants.find((x) => String(x.member) === String(payment.member) && x.status !== 'cancelled');
    if (p) {
      p.status = 'registered';
      p.payment = payment._id;
      await ev.save();
    }
  }

  // Notification with receipt attached (best effort)
  try {
    const [member, settings] = await Promise.all([Member.findById(payment.member), Setting.get()]);
    const pdf = await receiptPdf({ payment, member, settings });
    await notify({
      member,
      type: 'payment_confirmation',
      title: 'Payment received',
      message: `Dear ${member.firstName}, thank you for your payment. We have received ${money(payment.amount, payment.currency)} for ${payment.description}. Receipt No: ${payment.receiptNo}.${
        member.membershipExpiry && payment.subscription
          ? ` Your membership is valid till ${member.membershipExpiry.toLocaleDateString('en-IN')}.`
          : ''
      }`,
      link: '/my/payments',
      attachments: [{ filename: `${payment.receiptNo}.pdf`, content: pdf }],
    });
  } catch (err) {
    console.error('[payment] notification failed', err.message);
  }

  return payment;
}

/**
 * A subscription that costs ₹0 after its coupon needs no payment gateway:
 * record a ₹0 "coupon" payment (so it has a receipt and appears in history) and activate it.
 */
async function completeFreeSubscription(subscription, { recordedBy } = {}) {
  const payment = await Payment.create({
    member: subscription.member,
    subscription: subscription._id,
    purpose: 'membership',
    amount: 0,
    description: `${subscription.planSnapshot.name} membership – ${subscription.coupon?.label || 'coupon'} (${subscription.coupon?.code})`,
    method: 'coupon',
    referenceNo: subscription.coupon?.code,
    status: 'pending',
    recordedBy,
  });
  return completePayment(payment._id, { method: 'coupon', referenceNo: subscription.coupon?.code, recordedBy });
}

module.exports = { verifyCheckoutSignature, verifyWebhookSignature, completePayment, completeFreeSubscription };
