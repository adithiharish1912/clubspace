const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const c = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const upload = require('../middleware/upload');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again in a few minutes' },
});

const strongPassword = (field) =>
  body(field)
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/\d/)
    .withMessage('Password must contain a number');

router.post(
  '/register',
  authLimiter,
  validate([
    body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 60 }),
    body('lastName').optional().trim().isLength({ max: 60 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
    body('phone').trim().matches(/^[+\d][\d\s-]{6,18}$/).withMessage('Valid phone number is required'),
    strongPassword('password'),
    body('gender').optional().isIn(['male', 'female', 'other', '']),
    body('dateOfBirth').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date of birth'),
  ]),
  c.register
);
router.post(
  '/login',
  authLimiter,
  validate([body('email').trim().isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')]),
  c.login
);
router.post('/logout', protect, c.logout);
router.get('/me', protect, c.me);
router.get('/verify-email/:token', c.verifyEmail);
router.post('/resend-verification', protect, c.resendVerification);
router.post('/forgot-password', authLimiter, validate([body('email').trim().isEmail().withMessage('Valid email is required')]), c.forgotPassword);
router.post('/reset-password/:token', authLimiter, validate([strongPassword('password')]), c.resetPassword);
router.patch(
  '/change-password',
  protect,
  validate([body('currentPassword').notEmpty().withMessage('Current password is required'), strongPassword('newPassword')]),
  c.changePassword
);
router.patch(
  '/profile',
  protect,
  upload.single('avatar'),
  validate([body('name').optional().trim().isLength({ min: 2, max: 100 }), body('phone').optional().trim().isLength({ max: 20 })]),
  c.updateProfile
);

module.exports = router;
