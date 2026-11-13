const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/member.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const upload = require('../middleware/upload');
const { MEMBER_STATUS } = require('../models/Member');

router.use(protect);

const memberRules = (optional = false) => {
  const o = (chain) => (optional ? chain.optional() : chain);
  return [
    o(body('firstName')).trim().notEmpty().withMessage('First name is required').isLength({ max: 60 }),
    body('lastName').optional().trim().isLength({ max: 60 }),
    o(body('email')).trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
    o(body('phone')).trim().matches(/^[+\d][\d\s-]{6,18}$/).withMessage('Valid phone number is required'),
    body('gender').optional().isIn(['male', 'female', 'other', '']),
    body('dateOfBirth').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date of birth'),
    body('address').optional().isObject(),
    body('emergencyContact').optional().isObject(),
    body('notes').optional().isLength({ max: 1000 }),
  ];
};

router.get('/', authorize('admin', 'staff'), c.list);
router.post(
  '/',
  authorize('admin', 'staff'),
  validate([
    ...memberRules(),
    body('createLogin').optional().isBoolean(),
    body('password').optional({ values: 'falsy' }).isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('planId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid plan'),
  ]),
  c.create
);
router.get('/:id', validateObjectId(), c.get);
router.patch('/:id', validateObjectId(), validate(memberRules(true)), c.update);
router.patch(
  '/:id/status',
  validateObjectId(),
  authorize('admin'),
  validate([body('status').isIn(MEMBER_STATUS).withMessage('Invalid status'), body('reason').optional().isLength({ max: 300 })]),
  c.updateStatus
);
router.delete('/:id', validateObjectId(), authorize('admin'), c.remove);
router.post('/:id/photo', validateObjectId(), upload.single('photo'), c.uploadPhoto);
router.get('/:id/qr', validateObjectId(), c.qr);
router.post('/:id/qr/regenerate', validateObjectId(), c.regenerateQr);
router.get('/:id/subscriptions', validateObjectId(), c.subscriptions);

module.exports = router;
