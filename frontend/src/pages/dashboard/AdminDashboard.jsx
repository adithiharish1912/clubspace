import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import {
  AlarmClock, BellRing, CalendarDays, CircleDollarSign, Clock4, IndianRupee, ScanLine, UserCheck, UserPlus, Users, UserX,
} from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Badge, Button, Card, ErrorBox, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { compactMoney, dateTime, fullName, money, timeAgo } from '../../utils/format';

const STATUS_COLORS = { active: '#10b981', pending: '#f59e0b', expired: '#94a3b8', suspended: '#f43f5e', cancelled: '#be123c' };
const PLAN_COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899'];

export function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-ink-700">
      <p className="mb-1 font-bold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <b>{currency && p.dataKey === 'revenue' ? money(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch('/dashboard/admin');
  const [running, setRunning] = useState(false);

  const runReminders = async () => {
    setRunning(true);
    try {
      const r = await api.post('/notifications/run-reminders');
      const d = r.data.data;
      toast.success(`Done: ${d.membersExpired} expired, ${d.remindersSent} reminders, ${d.eventRemindersSent} event reminders`);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setRunning(false);
    }
  };

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const c = data.cards;

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]} 👋`}
        subtitle="Here's what's happening at your club today."
        actions={
          <>
            <Button variant="secondary" icon={BellRing} onClick={runReminders} loading={running}>
              Run reminders
            </Button>
            <Link to="/attendance" className="btn-primary">
              <ScanLine className="h-4 w-4" /> Check-in desk
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={c.totalMembers} icon={Users} onClick={() => navigate('/members')} hint={`${c.newRegistrations} new this month`} />
        <StatCard label="Active memberships" value={c.activeMembers} icon={UserCheck} tone="green" onClick={() => navigate('/members?status=active')} hint={`${c.expiringSoon} expiring in 7 days`} />
        <StatCard label="Expired memberships" value={c.expiredMembers} icon={UserX} tone="slate" onClick={() => navigate('/members?status=expired')} />
        <StatCard label="Total revenue" value={compactMoney(c.totalRevenue)} icon={IndianRupee} tone="violet" hint={`${money(c.monthRevenue)} this month`} onClick={() => navigate('/payments')} />
        <StatCard label="Pending payments" value={c.pendingPayments} icon={CircleDollarSign} tone="amber" hint={money(c.pendingAmount)} onClick={() => navigate('/payments?tab=pending')} />
        <StatCard label="New registrations" value={c.newRegistrations} icon={UserPlus} tone="cyan" hint="This month" onClick={() => navigate('/members')} />
        <StatCard label="Today's check-ins" value={c.todayAttendance} icon={Clock4} tone="brand" onClick={() => navigate('/attendance')} />
        <StatCard label="Upcoming events" value={c.upcomingEvents} icon={CalendarDays} tone="rose" onClick={() => navigate('/events')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Monthly revenue (net of refunds)" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={data.monthlyRevenue} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compactMoney} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip currency />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Membership status">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.membershipStatus.filter((s) => s.value)} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} stroke="none">
                  {data.membershipStatus.filter((s) => s.value).map((s) => (
                    <Cell key={s.name} fill={STATUS_COLORS[s.name]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(v) => <span className="text-xs capitalize text-slate-500">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="New registrations per month" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.monthlyRevenue} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-white/5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,.06)' }} />
                <Bar dataKey="registrations" name="Registrations" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                <Bar dataKey="payments" name="Payments" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Active plans">
          {data.planMix.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No active subscriptions yet</p>
          ) : (
            <ul className="space-y-4">
              {data.planMix.map((p, i) => {
                const total = data.planMix.reduce((s, x) => s + x.value, 0);
                const pct = Math.round((p.value / total) * 100);
                return (
                  <li key={p.name}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-slate-500">
                        {p.value} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent members" padded={false} action={<Link to="/members" className="text-xs font-semibold text-brand-600">View all</Link>}>
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {data.recentMembers.map((m) => (
              <li key={m._id}>
                <Link to={`/members/${m._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[.02]">
                  <Avatar src={m.photo?.url} name={fullName(m)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{fullName(m)}</span>
                    <span className="block text-xs text-slate-500">
                      {m.membershipId} · {timeAgo(m.createdAt)}
                    </span>
                  </span>
                  <Badge status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recent payments" padded={false} className="xl:col-span-2" action={<Link to="/payments" className="text-xs font-semibold text-brand-600">View all</Link>}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Receipt</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((p) => (
                  <tr key={p._id}>
                    <td className="font-semibold">{fullName(p.member)}</td>
                    <td className="text-slate-500">{p.receiptNo}</td>
                    <td className="capitalize">{p.method.replace('_', ' ')}</td>
                    <td className="text-slate-500">{dateTime(p.paidAt)}</td>
                    <td className="text-right font-bold">{money(p.amount)}</td>
                  </tr>
                ))}
                {data.recentPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No payments yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {c.expiringSoon > 0 && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3 font-semibold">
            <AlarmClock className="h-6 w-6" /> {c.expiringSoon} membership(s) expire in the next 7 days.
          </p>
          <Link to="/members?expiring=7" className="btn bg-white/20 text-white hover:bg-white/30">
            Review renewals
          </Link>
        </div>
      )}
    </>
  );
}
