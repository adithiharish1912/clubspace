import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Camera, CameraOff, CheckCircle2, ClipboardList, Hash, LogIn, LogOut, XCircle } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { errMsg } from '../../api/client';
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Pagination, Spinner, Toggle, cn } from '../../components/ui';
import { date, fullName, time, todayKey } from '../../utils/format';
import { ChartTooltip } from '../dashboard/AdminDashboard';

const QrScanner = lazy(() => import('./QrScanner'));

export default function Attendance() {
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [day, setDay] = useState(todayKey());
  const [insideOnly, setInsideOnly] = useState(false);
  const [page, setPage] = useState(1);
  const list = useFetch('/attendance', { date: day, inside: insideOnly ? 'true' : undefined, page, limit: 20 });
  const summary = useFetch('/attendance/summary');

  const submit = async (value) => {
    const v = String(value || '').trim();
    if (!v) return;
    setBusy(true);
    try {
      const r = await api.post('/attendance/scan', { code: v });
      setResult({ ok: true, ...r.data.data, message: r.data.message });
      toast.success(r.data.message);
      setCode('');
      list.reload();
      summary.reload();
    } catch (err) {
      setResult({ ok: false, message: errMsg(err) });
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async (memberId) => {
    try {
      await api.post('/attendance/check-out', { memberId });
      toast.success('Checked out');
      list.reload();
      summary.reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <>
      <PageHeader title="Attendance" subtitle="Scan a member's QR code or type their member ID to check in / out." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Check-in desk" action={
            <Button variant="secondary" className="px-3 py-1.5" icon={camera ? CameraOff : Camera} onClick={() => setCamera((c) => !c)}>
              {camera ? 'Stop camera' : 'Scan QR'}
            </Button>
          }>
            {camera && (
              <div className="mb-4">
                <Suspense fallback={<Spinner />}>
                  <QrScanner onScan={submit} />
                </Suspense>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(code);
              }}
              className="flex gap-2"
            >
              <Input icon={Hash} placeholder="Member ID e.g. CS-2026-00012" value={code} onChange={(e) => setCode(e.target.value)} className="flex-1" autoFocus />
              <Button type="submit" loading={busy}>Go</Button>
            </form>
            <p className="mt-2 text-xs text-slate-500">Scanning toggles: first scan checks in, the next scan checks out. A USB barcode/QR scanner works in this field too.</p>

            {result && (
              <div className={cn('mt-5 animate-scale-in rounded-2xl p-4', result.ok ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10')}>
                {result.ok ? (
                  <div className="flex items-center gap-3">
                    <Avatar src={result.member.photo?.url} name={result.member.fullName} size="h-14 w-14" />
                    <div className="flex-1">
                      <p className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                        {result.action === 'check-in' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        {result.action === 'check-in' ? 'Checked in' : 'Checked out'}
                      </p>
                      <p className="font-semibold">{result.member.fullName}</p>
                      <p className="text-xs text-slate-500">
                        {result.member.membershipId} · valid till {date(result.member.membershipExpiry)}
                      </p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                ) : (
                  <p className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-300">
                    <XCircle className="h-5 w-5 shrink-0" /> {result.message}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card title="Last 7 days">
            {summary.data ? (
              <>
                <div className="mb-3 flex gap-6 text-sm">
                  <p><span className="text-2xl font-extrabold">{summary.data.todayCount}</span> <span className="text-slate-500">today</span></p>
                  <p><span className="text-2xl font-extrabold text-emerald-600">{summary.data.inside}</span> <span className="text-slate-500">inside now</span></p>
                </div>
                <div className="h-40">
                  <ResponsiveContainer>
                    <BarChart data={summary.data.last7Days.map((d) => ({ ...d, day: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }) }))}>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,.06)' }} />
                      <Bar dataKey="count" name="Visits" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <Spinner />
            )}
          </Card>
        </div>

        <Card
          className="lg:col-span-3"
          padded={false}
          title="Attendance log"
          action={
            <div className="flex items-center gap-3">
              <Input type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} className="w-40" aria-label="Date" />
            </div>
          }
        >
          <div className="border-b border-slate-100 px-5 py-3 dark:border-white/5">
            <Toggle checked={insideOnly} onChange={(v) => { setInsideOnly(v); setPage(1); }} label="Show only members inside" />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>In</th>
                  <th>Out</th>
                  <th className="hidden sm:table-cell">Method</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(list.data || []).map((a) => (
                  <tr key={a._id}>
                    <td>
                      <Link to={`/members/${a.member?._id}`} className="flex items-center gap-3">
                        <Avatar src={a.member?.photo?.url} name={fullName(a.member)} size="h-8 w-8" />
                        <span>
                          <span className="block font-semibold">{fullName(a.member)}</span>
                          <span className="font-mono text-xs text-slate-400">{a.member?.membershipId}</span>
                        </span>
                      </Link>
                    </td>
                    <td>{time(a.checkIn)}</td>
                    <td>{a.checkOut ? <>{time(a.checkOut)} <span className="text-xs text-slate-400">({a.durationMinutes}m)</span></> : <Badge status="active">Inside</Badge>}</td>
                    <td className="hidden text-xs uppercase sm:table-cell">{a.method}</td>
                    <td className="text-right">
                      {!a.checkOut && (
                        <button className="text-xs font-semibold text-brand-600" onClick={() => checkOut(a.member._id)}>
                          Check out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.loading && !list.data && <div className="flex justify-center py-12"><Spinner /></div>}
          {list.data?.length === 0 && <EmptyState icon={ClipboardList} title="No attendance recorded" message="Check-ins for the selected day appear here." />}
          <Pagination meta={list.meta} onPage={setPage} />
        </Card>
      </div>
    </>
  );
}
