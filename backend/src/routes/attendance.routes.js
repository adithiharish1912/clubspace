const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/attendance.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(protect);

router.get('/', c.list);
router.get('/summary', authorize('admin', 'staff'), c.summary);
router.post('/scan', authorize('admin', 'staff'), validate([body('code').trim().notEmpty().withMessage('Code is required')]), c.scan);
router.post('/check-in', authorize('admin', 'staff'), validate([body('memberId').isMongoId()]), c.checkIn);
router.post('/check-out', authorize('admin', 'staff'), validate([body('memberId').isMongoId()]), c.checkOut);

module.exports = router;
