import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarDays, Clock, MapPin, Pencil, Trash2, UserPlus, Users, Ban } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePayment } from '../../context/PaymentContext';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Input, Modal, PageLoader, Select } from '../../components/ui';
import { dateTime, fullName, money } from '../../utils/format';
import { EventBanner } from './Events';
import EventForm from './EventForm';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isStaff, isMember } = useAuth();
  const { pay } = usePayment();
  const { data: ev, loading, error, reload } = useFetch(`/events/${id}`);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [cancelEv, setCancelEv] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [memberCode, setMemberCode] = useState('');

  if (loading && !ev) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const mine = ev.myRegistration;
  const open = ['upcoming', 'ongoing'].includes(ev.status);
  const full = ev.capacity > 0 && ev.registeredCount >= ev.capacity;

  const register = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/events/${id}/register`);
      if (r.data.data.status === 'pending_payment') {
        const paid = await pay({ eventId: id });
        if (paid) toast.success('Seat confirmed!');
      } else toast.success(r.data.message);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const payNow = async () => {
    const paid = await pay({ eventId: id });
    if (paid) reload();
  };

  const cancelReg = async (memberId) => {
    try {
      await api.post(`/events/${id}/cancel-registration`, memberId ? { memberId } : {});
      toast.success('Registration cancelled');
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    try {
      const found = await api.get('/members', { params: { q: memberCode, limit: 1 } });
      const m = found.data.data[0];
      if (!m) throw new Error('No member found');
      await api.post(`/events/${id}/register`, { memberId: m._id });
      toast.success(`${fullName(m)} registered`);
      setAddOpen(false);
      setMemberCode('');
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const setParticipant = async (pid, status) => {
    try {
      await api.patch(`/events/${id}/participants/${pid}`, { status });
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const collectFee = async (memberId) => {
    try {
      const r = await api.post('/payments/offline', { eventId: id, memberId, method: 'cash' });
      toast.success(`Fee recorded · ${r.data.data.receiptNo}`);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted');
      navigate('/events');
    } catch (err) {
      toast.error(errMsg(err));
      setDel(false);
    }
  };

  const cancelEvent = async () => {
    try {
      await api.patch(`/events/${id}`, { status: 'cancelled' });
      toast.success('Event cancelled and participants notified');
      setCancelEv(false);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <>
      <Link to="/events" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Events
      </Link>
      <div className="card mb-6 animate-fade-up overflow-hidden">
        <EventBanner event={ev} className="h-48 sm:h-64" />
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={ev.status} />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{ev.category}</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">{ev.title}</h1>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-600" />{dateTime(ev.startDate)}</p>
              <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-600" />Ends {dateTime(ev.endDate)}</p>
              {ev.venue && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-600" />{ev.venue}</p>}
              <p className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-600" />{ev.registeredCount}{ev.capacity ? ` / ${ev.capacity}` : ''} registered</p>
            </div>
            {ev.description && <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ev.description}</p>}
          </div>
          <div className="w-full shrink-0 rounded-2xl bg-slate-50 p-5 lg:w-72 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase text-slate-400">Entry fee</p>
            <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{ev.fee ? money(ev.fee) : 'Free'}</p>
            {ev.registrationDeadline && <p className="mt-1 text-xs text-slate-500">Registration closes {dateTime(ev.registrationDeadline)}</p>}
            {isMember && (
              <div className="mt-4 space-y-2">
                {mine?.status === 'registered' && (
                  <>
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">You're registered 🎉</p>
                    {!mine.payment && open && <Button variant="secondary" className="w-full" onClick={() => cancelReg()}>Cancel registration</Button>}
                  </>
                )}
                {mine?.status === 'pending_payment' && open && <Button className="w-full" onClick={payNow}>Pay {money(ev.fee)} to confirm</Button>}
                {(!mine || mine.status === 'cancelled') && open && (
                  <Button className="w-full" onClick={register} loading={busy} disabled={full}>
                    {full ? 'Event full' : ev.fee ? `Register & pay ${money(ev.fee)}` : 'Register'}
                  </Button>
                )}
                {mine?.status === 'attended' && <Badge status="attended">Attended</Badge>}
              </div>
            )}
            {isAdmin && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>Edit</Button>
                {ev.status !== 'cancelled' ? (
                  <Button variant="secondary" icon={Ban} onClick={() => setCancelEv(true)}>Cancel</Button>
                ) : (
                  <Button variant="secondary" icon={Trash2} onClick={() => setDel(true)}>Delete</Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isStaff && (
        <Card title={`Participants (${ev.registeredCount})`} padded={false} action={open && <Button variant="secondary" className="px-3 py-1.5" icon={UserPlus} onClick={() => setAddOpen(true)}>Add member</Button>}>
          {ev.participants?.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="hidden sm:table-cell">Phone</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ev.participants.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <Link to={`/members/${p.member?._id}`} className="flex items-center gap-3">
                          <Avatar src={p.member?.photo?.url} name={fullName(p.member)} size="h-8 w-8" />
                          <span>
                            <span className="block font-semibold">{fullName(p.member)}</span>
                            <span className="font-mono text-xs text-slate-400">{p.member?.membershipId}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden sm:table-cell">{p.member?.phone}</td>
                      <td className="text-slate-500">{dateTime(p.registeredAt)}</td>
                      <td>
                        <Select
                          value={p.status}
                          onChange={(e) => setParticipant(p._id, e.target.value)}
                          options={['registered', 'pending_payment', 'attended', 'cancelled']}
                          className="w-40"
                        />
                      </td>
                      <td>
                        {p.payment ? (
                          <Badge status="paid">Paid</Badge>
                        ) : p.status === 'pending_payment' ? (
                          <button className="whitespace-nowrap text-xs font-semibold text-brand-600" onClick={() => collectFee(p.member._id)}>
                            Collect {money(ev.fee)} cash
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Users} title="No registrations yet" />
          )}
        </Card>
      )}

      <EventForm open={edit} onClose={() => setEdit(false)} event={ev} onSaved={reload} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={remove} danger title="Delete event?" confirmText="Delete" message="This permanently removes the event and its registrations." />
      <ConfirmDialog open={cancelEv} onClose={() => setCancelEv(false)} onConfirm={cancelEvent} danger title="Cancel event?" confirmText="Cancel event" message="All registered participants will be notified. Refund paid registrations from the Payments page." />
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Register a member" size="max-w-md" footer={<Button type="submit" form="add-member">Register</Button>}>
        <form id="add-member" onSubmit={addMember}>
          <Input label="Member ID, email or phone" autoFocus value={memberCode} onChange={(e) => setMemberCode(e.target.value)} required />
          {ev.fee > 0 && <p className="mt-2 text-xs text-slate-500">Paid events: the member is added as “pending payment”. Collect the fee at the desk from the participants list, or let them pay online.</p>}
        </form>
      </Modal>
    </>
  );
}
