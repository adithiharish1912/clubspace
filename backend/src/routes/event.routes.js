const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/event.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const upload = require('../middleware/upload');

router.use(protect);

const rules = (optional = false) => {
  const o = (chain) => (optional ? chain.optional() : chain);
  return [
    o(body('title')).trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
    o(body('startDate')).isISO8601().withMessage('Valid start date is required'),
    o(body('endDate')).isISO8601().withMessage('Valid end date is required'),
    body('registrationDeadline').optional({ values: 'falsy' }).isISO8601(),
    body('capacity').optional({ values: 'falsy' }).isInt({ min: 0 }).toInt(),
    body('fee').optional({ values: 'falsy' }).isFloat({ min: 0 }).toFloat(),
    body('status').optional().isIn(['upcoming', 'ongoing', 'completed', 'cancelled']),
    body('description').optional().isLength({ max: 3000 }),
  ];
};

router.get('/', c.list);
router.get('/:id', validateObjectId(), c.get);
router.post('/', authorize('admin'), upload.single('banner'), validate(rules()), c.create);
router.patch('/:id', validateObjectId(), authorize('admin'), upload.single('banner'), validate(rules(true)), c.update);
router.delete('/:id', validateObjectId(), authorize('admin'), c.remove);
router.post('/:id/register', validateObjectId(), validate([body('memberId').optional().isMongoId()]), c.register);
router.post('/:id/cancel-registration', validateObjectId(), c.cancelRegistration);
router.patch(
  '/:id/participants/:participantId',
  validateObjectId('id', 'participantId'),
  authorize('admin', 'staff'),
  validate([body('status').isIn(['registered', 'pending_payment', 'attended', 'cancelled'])]),
  c.updateParticipant
);

module.exports = router;
