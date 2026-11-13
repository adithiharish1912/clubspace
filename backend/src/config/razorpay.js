const Razorpay = require('razorpay');
const env = require('./env');

const isRazorpayConfigured = Boolean(env.razorpay.keyId && env.razorpay.keySecret);

// Demo mode lets you exercise the full payment flow locally without Razorpay keys.
// It is never available in production.
const isDemoPaymentMode = !isRazorpayConfigured && !env.isProd;

const razorpay = isRazorpayConfigured
  ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  : null;

module.exports = { razorpay, isRazorpayConfigured, isDemoPaymentMode };
