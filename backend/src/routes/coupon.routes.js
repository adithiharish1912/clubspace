const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/coupon.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const { COUPON_TYPES } = require('../models/Coupon');

router.use(protect);

const rules = (optional = false) => {
  const o = (chain) => (optional ? chain.optional() : chain);
  return [
    o(body('code')).trim().notEmpty().withMessage('Coupon code is required').isLength({ max: 30 }).matches(/^[A-Za-z0-9_-]+$/).withMessage('Code may contain letters, numbers, - and _'),
    o(body('type')).isIn(COUPON_TYPES).withMessage('Choose a coupon type'),
    body('value').optional({ values: 'falsy' }).isFloat({ min: 0 }).toFloat(),
    body('maxUses').optional({ values: 'falsy' }).isInt({ min: 0 }).toInt(),
    body('validUntil').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date'),
    body('newMembersOnly').optional().isBoolean(),
    body('oncePerMember').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
    body('description').optional().isLength({ max: 200 }),
  ];
};

router.post(
  '/validate',
  validate([body('code').trim().notEmpty().withMessage('Enter a coupon code'), body('planId').optional().isMongoId(), body('memberId').optional().isMongoId()]),
  c.validate
);
router.get('/', authorize('admin'), c.list);
router.post('/', authorize('admin'), validate(rules()), c.create);
router.patch('/:id', validateObjectId(), authorize('admin'), validate(rules(true)), c.update);
router.delete('/:id', validateObjectId(), authorize('admin'), c.remove);

module.exports = router;
