require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5000,
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clubspace',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'ClubSpace <no-reply@clubspace.app>',
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
  },
  reminderCron: process.env.REMINDER_CRON || '0 9 * * *',
};

if (!env.jwtSecret) {
  if (env.isProd) {
    throw new Error('JWT_SECRET must be set in production');
  }
  env.jwtSecret = 'dev_only_insecure_secret_change_me';
  if (!env.isTest) console.warn('[env] JWT_SECRET not set – using an insecure development secret');
}

if (env.isProd && !(env.razorpay.keyId && env.razorpay.keySecret)) {
  console.warn('[env] Razorpay keys are missing – online payments are DISABLED in production');
}

module.exports = env;
