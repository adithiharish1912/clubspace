const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');
const paymentController = require('./controllers/payment.controller');
const misc = require('./routes/misc.routes');

const app = express();
app.set('trust proxy', 1); // Render / Vercel sit behind a proxy

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      // allow server-to-server tools (no Origin) and configured frontends
      if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(compression());
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

// Razorpay webhook needs the raw body for signature verification – mount before express.json()
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentController.webhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize()); // strips $ and . keys → prevents NoSQL operator injection

app.use(
  '/api',
  rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 10000 : 300, standardHeaders: 'draft-7', legacyHeaders: false })
);

// Local uploads (development fallback when Cloudinary is not configured)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/members', require('./routes/member.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/subscriptions', require('./routes/subscription.routes'));
app.use('/api/coupons', require('./routes/coupon.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/events', require('./routes/event.routes'));
app.use('/api/notifications', misc.notifications);
app.use('/api/dashboard', misc.dashboard);
app.use('/api/reports', misc.reports);
app.use('/api/users', misc.users);
app.use('/api/settings', misc.settings);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
