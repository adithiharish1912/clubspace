const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/plan.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const { DURATION_TYPES } = require('../models/MembershipPlan');

router.use(protect);

const rules = (optional = false) => {
  const o = (chain) => (optional ? chain.optional() : chain);
  return [
    o(body('name')).trim().notEmpty().withMessage('Plan name is required').isLength({ max: 80 }),
    o(body('code')).trim().notEmpty().withMessage('Plan code is required').isLength({ max: 20 }).matches(/^[A-Za-z0-9_-]+$/).withMessage('Code may contain letters, numbers, - and _'),
    o(body('durationType')).isIn(DURATION_TYPES).withMessage('Invalid duration type'),
    body('durationDays').optional({ values: 'falsy' }).isInt({ min: 1, max: 3650 }).withMessage('Duration must be 1–3650 days').toInt(),
    o(body('price')).isFloat({ min: 0 }).withMessage('Price must be 0 or more').toFloat(),
    body('taxPercent').optional().isFloat({ min: 0, max: 50 }).toFloat(),
    body('features').optional().isArray(),
    body('isPremium').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
    body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color must be a hex value like #2563eb'),
  ];
};

router.get('/', c.list);
router.get('/:id', validateObjectId(), c.get);
router.post('/', authorize('admin'), validate(rules()), c.create);
router.patch('/:id', validateObjectId(), authorize('admin'), validate(rules(true)), c.update);
router.delete('/:id', validateObjectId(), authorize('admin'), c.remove);

module.exports = router;
