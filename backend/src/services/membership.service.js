const { Member, Subscription, MembershipPlan } = require('../models');
const ApiError = require('../utils/ApiError');
const { addDays, round2 } = require('../utils/helpers');

/**
 * Creates a pending subscription for a member. It becomes active only after payment.
 * Any earlier pending (unpaid) subscription for the same member is cancelled so the
 * member never has two open checkouts.
 */
async function createPendingSubscription({ memberId, planId, createdBy }) {
  const [member, plan] = await Promise.all([Member.findById(memberId), MembershipPlan.findById(planId)]);
  if (!member) throw ApiError.notFound('Member not found');
  if (!plan || !plan.isActive) throw ApiError.badRequest('Selected plan is not available');
  if (['suspended', 'cancelled'].includes(member.status)) {
    throw ApiError.badRequest(`Member is ${member.status}. Reactivate the member first.`);
  }

  await Subscription.updateMany(
    { member: member._id, status: 'pending' },
    { $set: { status: 'cancelled', cancelledReason: 'Superseded by a newer checkout' } }
  );

  const hasHistory = await Subscription.exists({ member: member._id, status: { $in: ['active', 'expired'] } });
  const amount = round2(plan.price * (1 + (plan.taxPercent || 0) / 100));

  const sub = await Subscription.create({
    member: member._id,
    plan: plan._id,
    planSnapshot: {
      name: plan.name,
      code: plan.code,
      durationType: plan.durationType,
      durationDays: plan.durationDays,
      price: plan.price,
      taxPercent: plan.taxPercent,
    },
    type: hasHistory ? 'renewal' : 'new',
    amount,
    status: 'pending',
    createdBy,
  });
  return { subscription: sub, member, plan };
}

/**
 * Activates a paid subscription. Renewals made before expiry are stacked so
 * the member does not lose remaining days.
 */
async function activateSubscription(subscriptionId, paymentId) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw ApiError.notFound('Subscription not found');
  if (sub.status === 'active') return sub;

  const member = await Member.findById(sub.member);
  const now = new Date();
  const start = member.membershipExpiry && member.membershipExpiry > now ? member.membershipExpiry : now;
  const end = addDays(start, sub.planSnapshot.durationDays);

  sub.status = 'active';
  sub.startDate = start;
  sub.endDate = end;
  if (paymentId) sub.payment = paymentId;
  await sub.save();

  member.status = 'active';
  member.membershipExpiry = end;
  member.currentSubscription = sub._id;
  await member.save();
  return sub;
}

module.exports = { createPendingSubscription, activateSubscription };
