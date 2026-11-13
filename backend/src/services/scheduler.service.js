const cron = require('node-cron');
const env = require('../config/env');
const { Subscription, Member, Event, Setting } = require('../models');
const { notify } = require('./notification.service');
const { startOfDay, endOfDay, addDays } = require('../utils/helpers');

/** Marks overdue subscriptions/members as expired and notifies members. */
async function expireMemberships() {
  const now = new Date();
  const subs = await Subscription.find({ status: 'active', endDate: { $lt: now } });
  for (const sub of subs) {
    sub.status = 'expired';
    // eslint-disable-next-line no-await-in-loop
    await sub.save();
  }

  const members = await Member.find({ status: 'active', membershipExpiry: { $lt: now } });
  for (const m of members) {
    m.status = 'expired';
    // eslint-disable-next-line no-await-in-loop
    await m.save();
    // eslint-disable-next-line no-await-in-loop
    await notify({
      member: m,
      type: 'membership_expired',
      title: 'Your membership has expired',
      message: `Hi ${m.firstName}, your membership (${m.membershipId}) expired on ${m.membershipExpiry.toLocaleDateString('en-IN')}. Renew now to continue enjoying club facilities.`,
      link: '/my/membership',
    });
  }
  return { subscriptionsExpired: subs.length, membersExpired: members.length };
}

/** Sends expiry / renewal reminders N days before expiry (N from settings). */
async function sendExpiryReminders() {
  const settings = await Setting.get();
  let sent = 0;
  for (const days of settings.reminderDaysBefore || []) {
    const day = addDays(new Date(), days);
    // eslint-disable-next-line no-await-in-loop
    const members = await Member.find({
      status: 'active',
      membershipExpiry: { $gte: startOfDay(day), $lte: endOfDay(day) },
    });
    for (const m of members) {
      // eslint-disable-next-line no-await-in-loop
      const sub = await Subscription.findOne({ member: m._id, status: 'active', endDate: m.membershipExpiry });
      if (sub && sub.remindersSent.includes(days)) continue;
      // eslint-disable-next-line no-await-in-loop
      await notify({
        member: m,
        type: days <= 1 ? 'renewal_reminder' : 'expiry_reminder',
        title: days <= 1 ? 'Membership expires tomorrow' : `Membership expires in ${days} days`,
        message: `Hi ${m.firstName}, your membership ${m.membershipId} expires on ${m.membershipExpiry.toLocaleDateString('en-IN')}. Renew early – remaining days are carried forward.`,
        link: '/my/membership',
      });
      if (sub) {
        sub.remindersSent.push(days);
        // eslint-disable-next-line no-await-in-loop
        await sub.save();
      }
      sent += 1;
    }
  }
  return { remindersSent: sent };
}

/** Moves events through upcoming → ongoing → completed and reminds participants a day before. */
async function updateEvents() {
  const now = new Date();
  await Event.updateMany({ status: 'upcoming', startDate: { $lte: now }, endDate: { $gte: now } }, { status: 'ongoing' });
  await Event.updateMany({ status: { $in: ['upcoming', 'ongoing'] }, endDate: { $lt: now } }, { status: 'completed' });

  const tomorrow = addDays(now, 1);
  const events = await Event.find({
    status: 'upcoming',
    startDate: { $gte: startOfDay(tomorrow), $lte: endOfDay(tomorrow) },
  }).populate('participants.member');
  let reminded = 0;
  for (const ev of events) {
    for (const p of ev.participants) {
      if (p.status !== 'registered' || !p.member) continue;
      // eslint-disable-next-line no-await-in-loop
      await notify({
        member: p.member,
        type: 'event',
        title: `Reminder: ${ev.title} is tomorrow`,
        message: `${ev.title} starts ${ev.startDate.toLocaleString('en-IN')} at ${ev.venue || 'the club'}. See you there!`,
        link: `/events/${ev._id}`,
      });
      reminded += 1;
    }
  }
  return { eventRemindersSent: reminded };
}

async function runDailyJobs() {
  const a = await expireMemberships();
  const b = await sendExpiryReminders();
  const c = await updateEvents();
  return { ...a, ...b, ...c, ranAt: new Date() };
}

function startScheduler() {
  if (env.isTest) return null;
  const task = cron.schedule(env.reminderCron, () => {
    runDailyJobs()
      .then((r) => console.log('[scheduler] daily jobs done', r))
      .catch((e) => console.error('[scheduler] failed', e));
  });
  // Also run shortly after boot so a sleeping free-tier server catches up.
  setTimeout(() => runDailyJobs().catch((e) => console.error('[scheduler] boot run failed', e.message)), 15000);
  console.log(`[scheduler] daily jobs scheduled: "${env.reminderCron}"`);
  return task;
}

module.exports = { startScheduler, runDailyJobs, expireMemberships, sendExpiryReminders, updateEvents };
