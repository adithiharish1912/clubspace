const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/subscription.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');

router.use(protect);

router.get('/', c.list);
router.post(
  '/',
  validate([
    body('planId').isMongoId().withMessage('Select a plan'),
    body('memberId').optional().isMongoId(),
    body('couponCode').optional({ values: 'falsy' }).isString().isLength({ max: 30 }),
  ]),
  c.create
);
router.patch('/:id/cancel', validateObjectId(), authorize('admin'), c.cancel);

module.exports = router;
