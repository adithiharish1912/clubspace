import { useState } from 'react';
import toast from 'react-hot-toast';
import useFetch from '../../hooks/useFetch';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePayment } from '../../context/PaymentContext';
import MembershipCard from '../../components/MembershipCard';
import PlanCard from '../../components/PlanCard';
import { Badge, Button, Card, EmptyState, PageHeader, PageLoader } from '../../components/ui';
import { date, money } from '../../utils/format';

export default function MyMembership() {
  const { member, refresh } = useAuth();
  const { pay } = usePayment();
  const plans = useFetch('/plans');
  const history = useFetch(member ? `/members/${member._id}/subscriptions` : null);
  const club = useFetch('/settings/public');
  const [buying, setBuying] = useState('');

  if (!member) return <Card><EmptyState title="No member profile" message="This account is not linked to a member record." /></Card>;
  if (plans.loading && !plans.data) return <PageLoader />;

  const buy = async (plan) => {
    setBuying(plan._id);
    try {
      const { data } = await api.post('/subscriptions', { planId: plan._id });
      const paid = await pay({ subscriptionId: data.data.subscription._id });
      if (paid) {
        await refresh();
        history.reload();
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBuying('');
    }
  };

  const active = member.status === 'active';
  return (
    <>
      <PageHeader title="My membership" subtitle={active ? 'Renew any time – remaining days are carried forward.' : 'Choose a plan to activate your membership.'} />
      <div className="mb-8 max-w-xl">
        <MembershipCard member={member} clubName={club.data?.clubName} />
      </div>

      <h2 className="mb-4 text-lg font-bold">{active ? 'Renew or upgrade' : 'Choose your plan'}</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {(plans.data || []).map((p) => (
          <PlanCard key={p._id} plan={p} highlight={member.currentSubscription?.plan === p._id}>
            <Button className="w-full" loading={buying === p._id} disabled={Boolean(buying) || ['suspended', 'cancelled'].includes(member.status)} onClick={() => buy(p)}>
              {active ? 'Renew' : 'Get started'} · {money(p.totalPrice)}
            </Button>
          </PlanCard>
        ))}
      </div>

      <Card title="Membership history" padded={false} className="mt-8">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Type</th>
                <th>Status</th>
                <th>Start</th>
                <th>End</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(history.data || []).map((s) => (
                <tr key={s._id}>
                  <td className="font-semibold">{s.planSnapshot?.name}</td>
                  <td className="capitalize">{s.type}</td>
                  <td><Badge status={s.status} /></td>
                  <td>{date(s.startDate)}</td>
                  <td>{date(s.endDate)}</td>
                  <td className="text-right font-semibold">{money(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.data?.length === 0 && <EmptyState title="No history yet" />}
      </Card>
    </>
  );
}
