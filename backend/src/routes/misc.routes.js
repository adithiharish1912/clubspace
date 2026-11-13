const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const upload = require('../middleware/upload');
const notif = require('../controllers/notification.controller');
const dash = require('../controllers/dashboard.controller');
const report = require('../controllers/report.controller');
const users = require('../controllers/user.controller');
const settings = require('../controllers/settings.controller');

// ---------- Notifications ----------
const notifications = require('express').Router();
notifications.use(protect);
notifications.get('/', notif.mine);
notifications.patch('/read-all', notif.markAllRead);
notifications.get('/sent', authorize('admin'), notif.sentLog);
notifications.post(
  '/broadcast',
  authorize('admin'),
  validate([
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }),
    body('audience').optional().isIn(['all', 'active', 'expired', 'expiring']),
  ]),
  notif.broadcast
);
notifications.post('/run-reminders', authorize('admin'), notif.runReminders);
notifications.patch('/:id/read', validateObjectId(), notif.markRead);
notifications.delete('/:id', validateObjectId(), notif.remove);

// ---------- Dashboard ----------
const dashboard = require('express').Router();
dashboard.use(protect);
dashboard.get('/admin', authorize('admin'), dash.admin);
dashboard.get('/staff', authorize('admin', 'staff'), dash.staff);
dashboard.get('/member', authorize('member'), dash.member);

// ---------- Reports ----------
const reports = require('express').Router();
reports.use(protect, authorize('admin'));
reports.get('/:type', report.generate);

// ---------- Users (admin & staff accounts) ----------
const usersRouter = require('express').Router();
usersRouter.use(protect, authorize('admin'));
const userRules = (optional) => {
  const o = (chain) => (optional ? chain.optional() : chain);
  return [
    o(body('name')).trim().isLength({ min: 2, max: 100 }).withMessage('Name is required'),
    o(body('email')).trim().isEmail().withMessage('Valid email is required').normalizeEmail({ gmail_remove_dots: false }),
    o(body('password')).isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    o(body('role')).isIn(['superadmin', 'admin', 'staff']).withMessage('Invalid role'),
    body('isActive').optional().isBoolean(),
  ];
};
usersRouter.get('/', users.list);
usersRouter.post('/', validate(userRules(false)), users.create);
usersRouter.patch('/:id', validateObjectId(), validate(userRules(true)), users.update);
usersRouter.delete('/:id', validateObjectId(), users.remove);

// ---------- Settings ----------
const settingsRouter = require('express').Router();
settingsRouter.get('/public', settings.publicInfo);
settingsRouter.get('/', protect, authorize('admin'), settings.get);
settingsRouter.patch('/', protect, authorize('superadmin'), upload.single('logo'), settings.update);

module.exports = { notifications, dashboard, reports, users: usersRouter, settings: settingsRouter };
