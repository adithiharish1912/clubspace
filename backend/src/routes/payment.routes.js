const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');

// NOTE: POST /api/payments/webhook is mounted in app.js with a raw body parser.

router.use(protect);

router.get('/config', c.config);
router.get('/transactions/ledger', authorize('admin'), c.transactions);
router.get('/', c.list);
router.post(
  '/order',
  validate([body('subscriptionId').optional().isMongoId(), body('eventId').optional().isMongoId(), body('memberId').optional().isMongoId()]),
  c.createOrder
);
router.post(
  '/verify',
  validate([
    body('paymentId').isMongoId(),
    body('razorpay_order_id').notEmpty(),
    body('razorpay_payment_id').notEmpty(),
    body('razorpay_signature').notEmpty(),
  ]),
  c.verify
);
router.post('/demo/complete', validate([body('paymentId').isMongoId()]), c.demoComplete);
router.post(
  '/offline',
  authorize('admin', 'staff'),
  validate([
    body('method').isIn(['cash', 'upi', 'card', 'bank_transfer', 'cheque']).withMessage('Choose a payment method'),
    body('referenceNo').optional().isLength({ max: 80 }),
    body('subscriptionId').optional().isMongoId(),
    body('memberId').optional().isMongoId(),
    body('planId').optional().isMongoId(),
    body('eventId').optional().isMongoId(),
  ]),
  c.recordOffline
);
router.get('/:id', validateObjectId(), c.get);
router.get('/:id/receipt', validateObjectId(), c.receipt);
router.post('/:id/failed', validateObjectId(), c.markFailed);
router.post(
  '/:id/refund',
  validateObjectId(),
  authorize('admin'),
  validate([body('amount').optional().isFloat({ gt: 0 }).toFloat(), body('reason').trim().notEmpty().withMessage('Refund reason is required').isLength({ max: 300 })]),
  c.refund
);

module.exports = router;
