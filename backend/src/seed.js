/**
 * Seed script
 *   npm run seed            → super admin (from .env) + default plans + settings
 *   npm run seed -- --demo  → also demo admin/staff/member accounts, members, payments, attendance and events
 *
 * Safe to run more than once: existing records are left untouched.
 */
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { User, Member, MembershipPlan, Setting, Event, Attendance, Payment } = require('./models');
const { generateMembershipId } = require('./services/counter.service');
const { createPendingSubscription } = require('./services/membership.service');
const { completePayment } = require('./services/payment.service');
const { localDateKey, addDays } = require('./utils/helpers');

const PLANS = [
  { name: 'Monthly', code: 'MONTHLY', durationType: 'monthly', durationDays: 30, price: 999, taxPercent: 18, sortOrder: 1, color: '#0ea5e9', features: ['Full club access', 'Locker room', 'Member events'] },
  { name: 'Quarterly', code: 'QUARTERLY', durationType: 'quarterly', durationDays: 90, price: 2699, taxPercent: 18, sortOrder: 2, color: '#2563eb', features: ['Everything in Monthly', '10% savings', '1 guest pass / month'] },
  { name: 'Half-Yearly', code: 'HALFYEARLY', durationType: 'half-yearly', durationDays: 180, price: 4999, taxPercent: 18, sortOrder: 3, color: '#4f46e5', features: ['Everything in Quarterly', '17% savings', 'Priority event booking'] },
  { name: 'Annual', code: 'ANNUAL', durationType: 'annual', durationDays: 365, price: 8999, taxPercent: 18, sortOrder: 4, color: '#7c3aed', features: ['Everything in Half-Yearly', '25% savings', 'Free club merchandise'] },
  { name: 'Premium Annual', code: 'PREMIUM', durationType: 'annual', durationDays: 365, price: 14999, taxPercent: 18, isPremium: true, sortOrder: 5, color: '#0f172a', features: ['All facilities 24×7', 'Personal trainer sessions', 'Lounge access', 'Unlimited guest passes'] },
];

const DEMO_PASSWORD = 'Demo@1234';

async function upsertUser(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return existing;
  return User.create({ ...data, isEmailVerified: true });
}

async function seedBase() {
  await Setting.get();
  const sa = await upsertUser({
    name: process.env.SUPERADMIN_NAME || 'Super Admin',
    email: (process.env.SUPERADMIN_EMAIL || 'superadmin@clubspace.app').toLowerCase(),
    password: process.env.SUPERADMIN_PASSWORD || 'ChangeMe@123',
    role: 'superadmin',
  });
  console.log(`✔ Super admin: ${sa.email}`);
  for (const p of PLANS) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await MembershipPlan.exists({ code: p.code }))) await MembershipPlan.create(p);
  }
  console.log(`✔ Plans: ${PLANS.map((p) => p.name).join(', ')}`);
}

async function seedDemo() {
  if (env.isProd) {
    console.log('✖ Refusing to create demo data in production');
    return;
  }
  await upsertUser({ name: 'Club Admin', email: 'admin@clubspace.app', password: DEMO_PASSWORD, role: 'admin', phone: '9000000001' });
  await upsertUser({ name: 'Front Desk', email: 'staff@clubspace.app', password: DEMO_PASSWORD, role: 'staff', phone: '9000000002' });

  if ((await Member.countDocuments()) > 0) {
    console.log('• Members already exist – skipping demo members');
    return;
  }
  const plans = await MembershipPlan.find().sort('sortOrder');
  const people = [
    ['Aarav', 'Sharma', 'male'], ['Diya', 'Patel', 'female'], ['Rohan', 'Kumar', 'male'], ['Ananya', 'Rao', 'female'],
    ['Vikram', 'Singh', 'male'], ['Meera', 'Iyer', 'female'], ['Kabir', 'Mehta', 'male'], ['Isha', 'Nair', 'female'],
    ['Arjun', 'Reddy', 'male'], ['Sneha', 'Gowda', 'female'], ['Rahul', 'Joshi', 'male'], ['Priya', 'Hegde', 'female'],
  ];

  const memberUser = await upsertUser({ name: 'Demo Member', email: 'member@clubspace.app', password: DEMO_PASSWORD, role: 'member', phone: '9000000003' });
  const created = [];
  created.push(
    await Member.create({ user: memberUser._id, membershipId: await generateMembershipId(), firstName: 'Demo', lastName: 'Member', email: memberUser.email, phone: '9000000003', gender: 'other' })
  );
  for (const [i, [first, last, gender]] of people.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const m = await Member.create({
      membershipId: await generateMembershipId(),
      firstName: first,
      lastName: last,
      gender,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone: `98${String(45000000 + i * 1371).padStart(8, '0')}`,
      address: { city: ['Bengaluru', 'Mysuru', 'Davangere', 'Hubballi'][i % 4], state: 'Karnataka' },
    });
    // Backdate join dates so charts have history (raw update: createdAt is immutable in Mongoose)
    const joined = addDays(new Date(), -Math.floor(Math.random() * 300));
    // eslint-disable-next-line no-await-in-loop
    await Member.collection.updateOne({ _id: m._id }, { $set: { createdAt: joined, joinedAt: joined } });
    created.push(m);
  }

  const methods = ['cash', 'upi', 'card', 'demo'];
  for (const [i, m] of created.entries()) {
    if (i === created.length - 1) continue; // leave one member pending
    const plan = plans[i % plans.length];
    // eslint-disable-next-line no-await-in-loop
    const { subscription } = await createPendingSubscription({ memberId: m._id, planId: plan._id });
    // eslint-disable-next-line no-await-in-loop
    const pay = await Payment.create({
      member: m._id,
      subscription: subscription._id,
      purpose: 'membership',
      amount: subscription.amount,
      description: `${plan.name} membership (new)`,
      method: methods[i % methods.length],
      status: 'pending',
    });
    // eslint-disable-next-line no-await-in-loop
    await completePayment(pay._id, { method: methods[i % methods.length] });
    // spread payment dates over the last months for the revenue chart
    const back = Math.floor(Math.random() * 300);
    // eslint-disable-next-line no-await-in-loop
    await Payment.updateOne({ _id: pay._id }, { paidAt: addDays(new Date(), -back) });
  }

  // Attendance for the last 14 days
  const active = await Member.find({ status: 'active' });
  for (let d = 13; d >= 0; d -= 1) {
    const day = addDays(new Date(), -d);
    const visitors = active.filter(() => Math.random() > 0.45);
    for (const m of visitors) {
      const inTime = new Date(day);
      inTime.setHours(6 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
      if (inTime > new Date()) continue;
      const out = d === 0 && Math.random() > 0.5 ? undefined : new Date(inTime.getTime() + (45 + Math.random() * 90) * 60000);
      // eslint-disable-next-line no-await-in-loop
      await Attendance.create({ member: m._id, date: localDateKey(day), checkIn: inTime, checkOut: out, durationMinutes: out ? Math.round((out - inTime) / 60000) : undefined, method: Math.random() > 0.3 ? 'qr' : 'manual' });
    }
  }

  const admin = await User.findOne({ email: 'admin@clubspace.app' });
  const ev = (title, days, fee, cat) => ({
    title, category: cat, venue: 'Main Hall', fee, capacity: 50, createdBy: admin._id,
    description: `${title} – open to all active members. Light refreshments will be served.`,
    startDate: addDays(new Date(), days), endDate: addDays(new Date(), days + 0.1),
  });
  await Event.create([
    ev('Yoga at Sunrise', 3, 0, 'Fitness'),
    ev('Annual Members Meet', 10, 0, 'Community'),
    ev('Badminton Tournament', 18, 299, 'Sports'),
    { ...ev('Diwali Celebration', -20, 0, 'Festival'), status: 'completed' },
  ]);

  console.log(`✔ Demo data: ${created.length} members, attendance, events`);
  console.log(`  Demo logins (password ${DEMO_PASSWORD}): admin@clubspace.app, staff@clubspace.app, member@clubspace.app`);
}

(async () => {
  try {
    await connectDB();
    await seedBase();
    if (process.argv.includes('--demo')) await seedDemo();
    console.log('Done.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
