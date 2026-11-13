import { Link, useNavigate } from 'react-router-dom';
import { AlarmClock, CircleDollarSign, DoorOpen, ScanLine, UserPlus, Users } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Card, EmptyState, ErrorBox, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { fullName, time } from '../../utils/format';

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch('/dashboard/staff');
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.name.split(' ')[0]}`}
        subtitle="Front desk overview for today."
        actions={
          <>
            <Link to="/members?new=1" className="btn-secondary">
              <UserPlus className="h-4 w-4" /> New member
            </Link>
            <Link to="/attendance" className="btn-primary">
              <ScanLine className="h-4 w-4" /> Scan QR
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Check-ins today" value={data.todayCount} icon={Users} onClick={() => navigate('/attendance')} />
        <StatCard label="Inside now" value={data.inside} icon={DoorOpen} tone="green" onClick={() => navigate('/attendance')} />
        <StatCard label="Expiring in 7 days" value={data.expiringSoon} icon={AlarmClock} tone="amber" onClick={() => navigate('/members?expiring=7')} />
        <StatCard label="Awaiting payment" value={data.pendingPayments} icon={CircleDollarSign} tone="rose" onClick={() => navigate('/members?status=pending')} />
      </div>
      <Card title="Today's activity" padded={false} className="mt-6">
        {data.recent.length === 0 ? (
          <EmptyState title="No check-ins yet today" message="Scan a member's QR code to record attendance." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {data.recent.map((a) => (
              <li key={a._id} className="flex items-center gap-3 px-5 py-3">
                <Avatar src={a.member?.photo?.url} name={fullName(a.member)} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{fullName(a.member)}</span>
                  <span className="text-xs text-slate-500">{a.member?.membershipId}</span>
                </span>
                <span className="text-right text-xs text-slate-500">
                  In {time(a.checkIn)}
                  <br />
                  {a.checkOut ? `Out ${time(a.checkOut)}` : <span className="font-semibold text-emerald-600">Inside</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
