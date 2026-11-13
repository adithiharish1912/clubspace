const { Event, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, paginate, pageMeta, escapeRegex } = require('../utils/helpers');
const { isStaffOrAbove } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../services/upload.service');
const { notify } = require('../services/notification.service');

const FIELDS = ['title', 'description', 'category', 'venue', 'startDate', 'endDate', 'registrationDeadline', 'capacity', 'fee', 'status', 'membersOnly'];
const pick = (b) => FIELDS.reduce((a, k) => (b[k] !== undefined && b[k] !== '' ? { ...a, [k]: b[k] } : a), {});

const shape = (ev, req) => {
  const o = ev.toJSON();
  const mine = req.member && ev.participants.find((p) => String(p.member?._id || p.member) === String(req.member._id));
  o.myRegistration = mine ? { status: mine.status, payment: mine.payment } : null;
  if (!isStaffOrAbove(req.user)) delete o.participants;
  return o;
};

// GET /api/events?status=&q=&upcoming=true
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.upcoming === 'true') filter.endDate = { $gte: new Date() };
  if (req.query.q) filter.title = new RegExp(escapeRegex(req.query.q), 'i');
  if (!isStaffOrAbove(req.user) && (!req.query.status || req.query.status === 'cancelled')) filter.status = { $ne: 'cancelled' };
  const pg = paginate({ ...req.query, limit: req.query.limit || 12 });
  const [items, total] = await Promise.all([
    Event.find(filter).sort(req.query.upcoming === 'true' ? 'startDate' : '-startDate').skip(pg.skip).limit(pg.limit),
    Event.countDocuments(filter),
  ]);
  res.json({ success: true, data: items.map((e) => shape(e, req)), meta: pageMeta(total, pg) });
});

// GET /api/events/:id
exports.get = asyncHandler(async (req, res) => {
  const ev = await Event.findById(req.params.id).populate('participants.member', 'firstName lastName membershipId email phone photo');
  if (!ev) throw ApiError.notFound('Event not found');
  res.json({ success: true, data: shape(ev, req) });
});

// POST /api/events (admin) – multipart allowed (banner)
exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body);
  if (req.file) data.banner = await uploadImage(req.file, 'events');
  const ev = await Event.create({ ...data, createdBy: req.user._id });
  if (req.body.notifyMembers === 'true' || req.body.notifyMembers === true) {
    const members = await Member.find({ status: 'active' }).limit(5000);
    for (const m of members) {
      // eslint-disable-next-line no-await-in-loop
      await notify({
        member: m,
        type: 'event',
        title: `New event: ${ev.title}`,
        message: `${ev.title} on ${new Date(ev.startDate).toLocaleString('en-IN')} at ${ev.venue || 'the club'}.${ev.fee ? ` Fee: Rs. ${ev.fee}.` : ' Free for members.'} Register now in ClubSpace.`,
        link: `/events/${ev._id}`,
        whatsapp: false,
      });
    }
  }
  res.status(201).json({ success: true, data: ev });
});

// PATCH /api/events/:id (admin)
exports.update = asyncHandler(async (req, res) => {
  const ev = await Event.findById(req.params.id);
  if (!ev) throw ApiError.notFound('Event not found');
  const before = ev.status;
  Object.assign(ev, pick(req.body));
  if (req.file) {
    const img = await uploadImage(req.file, 'events');
    await deleteImage(ev.banner?.publicId);
    ev.banner = img;
  }
  await ev.save();
  if (before !== 'cancelled' && ev.status === 'cancelled') {
    const ids = ev.participants.filter((p) => p.status !== 'cancelled').map((p) => p.member);
    const members = await Member.find({ _id: { $in: ids } });
    for (const m of members) {
      // eslint-disable-next-line no-await-in-loop
      await notify({ member: m, type: 'event', title: `Event cancelled: ${ev.title}`, message: `We're sorry, ${ev.title} has been cancelled. Any fee paid will be refunded.`, link: `/events/${ev._id}` });
    }
  }
  res.json({ success: true, data: ev });
});

// DELETE /api/events/:id (admin)
exports.remove = asyncHandler(async (req, res) => {
  const ev = await Event.findById(req.params.id);
  if (!ev) throw ApiError.notFound('Event not found');
  if (ev.participants.some((p) => p.payment)) throw ApiError.badRequest('Event has paid registrations – cancel it instead of deleting');
  await deleteImage(ev.banner?.publicId);
  await ev.deleteOne();
  res.json({ success: true, message: 'Event deleted' });
});

// POST /api/events/:id/register  { memberId? } – members register themselves, staff can register anyone
exports.register = asyncHandler(async (req, res) => {
  const memberId = isStaffOrAbove(req.user) ? req.body.memberId : req.member?._id;
  if (!memberId) throw ApiError.badRequest('memberId is required');
  const [ev, member] = await Promise.all([Event.findById(req.params.id), Member.findById(memberId)]);
  if (!ev) throw ApiError.notFound('Event not found');
  if (!member) throw ApiError.notFound('Member not found');
  if (['cancelled', 'completed'].includes(ev.status)) throw ApiError.badRequest(`Event is ${ev.status}`);
  if (ev.registrationDeadline && ev.registrationDeadline < new Date()) throw ApiError.badRequest('Registration has closed');
  if (ev.membersOnly && member.status !== 'active') throw ApiError.badRequest('An active membership is required to register');

  const existing = ev.participants.find((p) => String(p.member) === String(member._id));
  if (existing && existing.status !== 'cancelled') throw ApiError.conflict('Already registered for this event');
  if (ev.capacity > 0 && ev.registeredCount >= ev.capacity) throw ApiError.badRequest('Event is full');

  const status = ev.fee > 0 ? 'pending_payment' : 'registered';
  if (existing) {
    existing.status = status;
    existing.registeredAt = new Date();
  } else {
    ev.participants.push({ member: member._id, status });
  }
  await ev.save();

  if (status === 'registered') {
    await notify({ member, type: 'event', title: `Registered: ${ev.title}`, message: `You're registered for ${ev.title} on ${new Date(ev.startDate).toLocaleString('en-IN')} at ${ev.venue || 'the club'}.`, link: `/events/${ev._id}`, whatsapp: false });
  }
  res.status(201).json({ success: true, message: status === 'registered' ? 'Registered successfully' : 'Complete the payment to confirm your seat', data: { status, eventId: ev._id, fee: ev.fee } });
});

// POST /api/events/:id/cancel-registration { memberId? }
exports.cancelRegistration = asyncHandler(async (req, res) => {
  const memberId = isStaffOrAbove(req.user) ? req.body.memberId : req.member?._id;
  const ev = await Event.findById(req.params.id);
  if (!ev) throw ApiError.notFound('Event not found');
  const p = ev.participants.find((x) => String(x.member) === String(memberId) && x.status !== 'cancelled');
  if (!p) throw ApiError.badRequest('Not registered');
  if (p.payment && !isStaffOrAbove(req.user)) throw ApiError.badRequest('Paid registrations can be cancelled by the club office (refund required)');
  p.status = 'cancelled';
  await ev.save();
  res.json({ success: true, message: 'Registration cancelled' });
});

// PATCH /api/events/:id/participants/:participantId { status } (staff) – e.g. mark attended
exports.updateParticipant = asyncHandler(async (req, res) => {
  const ev = await Event.findById(req.params.id);
  if (!ev) throw ApiError.notFound('Event not found');
  const p = ev.participants.id(req.params.participantId);
  if (!p) throw ApiError.notFound('Participant not found');
  p.status = req.body.status;
  await ev.save();
  res.json({ success: true, data: p });
});
