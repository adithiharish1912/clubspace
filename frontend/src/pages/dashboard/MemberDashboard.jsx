import { Link } from 'react-router-dom';
import { CalendarDays, CalendarRange, Footprints, Hourglass, Sparkles } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { usePayment } from '../../context/PaymentContext';
import MembershipCard from '../../components/MembershipCard';
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { date, dateTime, money } from '../../utils/format';

export default function MemberDashboard() {
  const { user, refresh } = useAuth();
  const { pay } = usePayment();
  const { data, loading, error, reload } = useFetch('/dashboard/member');
  const club = useFetch('/settings/public');

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const m = data.member;

  const payPending = async () => {
    const r = await pay({ subscriptionId: data.pendingSubscription._id });
    if (r) {
      reload();
      refresh();
    }
  };

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}!`} subtitle="Your membership at a glance." />

      {data.pendingSubscription && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <b>{data.pendingSubscription.planSnapshot.name}</b> plan is awaiting payment of <b>{money(data.pendingSubscription.amount)}</b>.
          </p>
          <Button onClick={payPending}>Pay now</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MembershipCard member={m} clubName={club.data?.clubName} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          <StatCard
            label="Days remaining"
            value={data.daysLeft > 0 ? data.daysLeft : 0}
            icon={Hourglass}
            tone={data.daysLeft > 7 ? 'green' : data.daysLeft > 0 ? 'amber' : 'rose'}
            hint={m.membershipExpiry ? `Expires ${date(m.membershipExpiry)}` : 'No active plan'}
          />
          <StatCard label="Visits this month" value={data.visitsThisMonth} icon={Footprints} hint={`${data.totalVisits} visits in total`} />
        </div>
      </div>

      {(m.status !== 'active' || data.daysLeft <= 15) && !data.pendingSubscription && (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 p-6 text-white shadow-glow sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-lg font-bold">{m.status === 'active' ? 'Renew early, lose nothing' : 'Activate your membership'}</p>
              <p className="text-sm text-brand-100">
                {m.status === 'active' ? 'Remaining days are carried forward when you renew.' : 'Pick a plan and pay online in seconds.'}
              </p>
            </div>
          </div>
          <Link to="/my/membership" className="btn bg-white text-brand-700 hover:bg-brand-50">
            {m.status === 'active' ? 'Renew now' : 'Choose a plan'}
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Upcoming events" action={<Link to="/events" className="text-xs font-semibold text-brand-600">All events</Link>} padded={false}>
          {data.upcomingEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No upcoming events" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {data.upcomingEvents.map((e) => (
                <li key={e._id}>
                  <Link to={`/events/${e._id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[.02]">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                      <span className="text-[10px] font-bold uppercase">{new Date(e.startDate).toLocaleString('en', { month: 'short' })}</span>
                      <span className="text-lg font-extrabold leading-none">{new Date(e.startDate).getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.title}</span>
                      <span className="text-xs text-slate-500">
                        {dateTime(e.startDate)} · {e.fee ? money(e.fee) : 'Free'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent payments" action={<Link to="/my/payments" className="text-xs font-semibold text-brand-600">History</Link>} padded={false}>
          {data.payments.length === 0 ? (
            <EmptyState icon={CalendarRange} title="No payments yet" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {data.payments.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.description}</span>
                    <span className="text-xs text-slate-500">{date(p.paidAt || p.createdAt)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{money(p.amount)}</span>
                    <Badge status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
