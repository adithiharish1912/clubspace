import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Banknote, Ban, CheckCircle2, Download, Pencil, QrCode, RefreshCw, Trash2, Mail, Phone } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { download, errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, KeyValue, Modal, PageLoader, Select, Tabs, Textarea,
} from '../../components/ui';
import MembershipCard from '../../components/MembershipCard';
import RecordPaymentModal from '../../components/RecordPaymentModal';
import { date, dateTime, fullName, money, time } from '../../utils/format';
import MemberForm from './MemberForm';

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data, loading, error, reload } = useFetch(`/members/${id}`);
  const attendance = useFetch('/attendance', { member: id, limit: 30 });
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(null); // { subscription? }
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: 'suspended', reason: '' });
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState(false);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const { member: m, subscriptions, payments, stats } = data;
  const pending = subscriptions.find((s) => s.status === 'pending');

  const changeStatus = async () => {
    setBusy(true);
    try {
      await api.patch(`/members/${id}/status`, statusForm);
      toast.success('Status updated');
      setStatusOpen(false);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/members/${id}`);
      toast.success('Member deleted');
      navigate('/members');
    } catch (err) {
      toast.error(errMsg(err));
      setDel(false);
    } finally {
      setBusy(false);
    }
  };

  const regenQr = async () => {
    await api.post(`/members/${id}/qr/regenerate`);
    toast.success('New QR code issued – the old one no longer works');
    setCard(false);
  };

  return (
    <>
      <Link to="/members" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Members
      </Link>

      <div className="card mb-6 flex animate-fade-up flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={m.photo?.url} name={fullName(m)} size="h-16 w-16" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{fullName(m)}</h1>
              <Badge status={m.status} />
            </div>
            <p className="font-mono text-sm text-slate-500">{m.membershipId}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Mail className="h-3.5 w-3.5" />{m.email}</a>
              <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Phone className="h-3.5 w-3.5" />{m.phone}</a>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pending ? (
            <Button icon={Banknote} onClick={() => setPay({ subscription: pending })}>
              Collect {money(pending.amount)}
            </Button>
          ) : (
            <Button icon={Banknote} onClick={() => setPay({})} disabled={['suspended', 'cancelled'].includes(m.status)}>
              {m.status === 'active' ? 'Renew' : 'Activate'}
            </Button>
          )}
          <Button variant="secondary" icon={QrCode} onClick={() => setCard(true)}>
            Card
          </Button>
          <Button variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>
            Edit
          </Button>
          {isAdmin && (
            <>
              <Button variant="secondary" icon={m.status === 'suspended' ? CheckCircle2 : Ban} onClick={() => { setStatusForm({ status: m.status === 'suspended' ? 'active' : 'suspended', reason: '' }); setStatusOpen(true); }}>
                Status
              </Button>
              <Button variant="ghost" className="text-rose-600" icon={Trash2} onClick={() => setDel(true)} aria-label="Delete" />
            </>
          )}
        </div>
      </div>

      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'history', label: 'Membership history', count: subscriptions.length },
            { value: 'payments', label: 'Payments', count: payments.length },
            { value: 'attendance', label: 'Attendance', count: stats.attendanceCount },
          ]}
        />
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="Personal information" className="lg:col-span-2">
            <KeyValue
              items={[
                ['Gender', m.gender],
                ['Date of birth', date(m.dateOfBirth)],
                ['Occupation', m.occupation],
                ['Joined', date(m.joinedAt)],
                ['Address', [m.address?.line1, m.address?.city, m.address?.state, m.address?.pincode].filter(Boolean).join(', ')],
                ['Emergency contact', m.emergencyContact?.name && `${m.emergencyContact.name} (${m.emergencyContact.relation || '—'}) ${m.emergencyContact.phone || ''}`],
                ['Login account', m.user ? `${m.user.email}${m.user.isEmailVerified ? ' ✓ verified' : ''}` : 'No login'],
                ['Last visit', stats.lastVisit ? dateTime(stats.lastVisit) : 'Never'],
              ]}
            />
            {m.notes && <p className="mt-5 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">{m.notes}</p>}
          </Card>
          <Card title="Current membership">
            {m.currentSubscription ? (
              <KeyValue
                items={[
                  ['Plan', m.currentSubscription.planSnapshot?.name],
                  ['Type', m.currentSubscription.type],
                  ['Started', date(m.currentSubscription.startDate)],
                  ['Expires', date(m.membershipExpiry)],
                  ['Days left', m.membershipExpiry ? Math.max(0, Math.ceil((new Date(m.membershipExpiry) - new Date()) / 864e5)) : 0],
                  ['Total visits', stats.attendanceCount],
                ]}
              />
            ) : (
              <EmptyState title="No active plan" message="Collect a payment to activate the membership." />
            )}
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card padded={false}>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s._id}>
                    <td className="font-semibold">{s.planSnapshot?.name}</td>
                    <td className="capitalize">{s.type}</td>
                    <td><Badge status={s.status} /></td>
                    <td>{date(s.startDate)}</td>
                    <td>{date(s.endDate)}</td>
                    <td className="text-right font-semibold">{money(s.amount)}</td>
                    <td className="text-right">
                      {s.status === 'pending' && (
                        <button className="text-xs font-semibold text-brand-600" onClick={() => setPay({ subscription: s })}>
                          Collect
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subscriptions.length === 0 && <EmptyState title="No subscriptions yet" />}
        </Card>
      )}

      {tab === 'payments' && (
        <Card padded={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt</th>
                  <th>Description</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{date(p.paidAt || p.createdAt)}</td>
                    <td className="font-mono text-xs">{p.receiptNo || '—'}</td>
                    <td>{p.description}</td>
                    <td className="capitalize">{p.method.replace('_', ' ')}</td>
                    <td><Badge status={p.status} /></td>
                    <td className="text-right font-semibold">{money(p.amount)}</td>
                    <td className="text-right">
                      {p.receiptNo && (
                        <button className="btn-ghost p-1.5" title="Download receipt" onClick={() => download(`/payments/${p._id}/receipt`, null, `${p.receiptNo}.pdf`)}>
                          <Download className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length === 0 && <EmptyState title="No payments yet" />}
        </Card>
      )}

      {tab === 'attendance' && (
        <Card padded={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Duration</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {(attendance.data || []).map((a) => (
                  <tr key={a._id}>
                    <td>{date(a.checkIn)}</td>
                    <td>{time(a.checkIn)}</td>
                    <td>{a.checkOut ? time(a.checkOut) : <Badge status="active">Inside</Badge>}</td>
                    <td>{a.durationMinutes ? `${a.durationMinutes} min` : '—'}</td>
                    <td className="uppercase text-xs">{a.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attendance.data?.length === 0 && <EmptyState title="No visits recorded" />}
        </Card>
      )}

      <MemberForm open={edit} onClose={() => setEdit(false)} member={m} onSaved={reload} />
      <RecordPaymentModal open={Boolean(pay)} onClose={() => setPay(null)} member={m} subscription={pay?.subscription} onDone={reload} />

      <Modal open={card} onClose={() => setCard(false)} title="Membership card" size="max-w-lg" footer={<Button variant="secondary" icon={RefreshCw} onClick={regenQr}>Re-issue QR (lost card)</Button>}>
        <MembershipCard member={m} />
      </Modal>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change member status"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button onClick={changeStatus} loading={busy}>Update</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="New status" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })} options={['active', 'suspended', 'cancelled', 'expired']} />
          <Textarea label="Reason (saved in notes)" value={statusForm.reason} onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Delete member?"
        confirmText="Delete"
        message={`${fullName(m)} and their login, subscriptions and attendance will be permanently removed. Members with payment history cannot be deleted – cancel them instead.`}
      />
    </>
  );
}
