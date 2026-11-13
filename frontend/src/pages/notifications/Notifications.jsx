import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, Mail, Megaphone, MessageCircle, Send, Trash2 } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Pagination, Select, Spinner, Tabs, Textarea, Toggle, cn } from '../../components/ui';
import { dateTime, fullName, label, timeAgo } from '../../utils/format';

function Inbox() {
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const { data, meta, loading, reload } = useFetch('/notifications', { page, unread: unread ? 'true' : undefined });

  const act = async (fn) => {
    await fn();
    reload();
  };

  return (
    <Card
      padded={false}
      title={`Inbox${meta?.unread ? ` · ${meta.unread} unread` : ''}`}
      action={
        <div className="flex items-center gap-3">
          <Toggle checked={unread} onChange={(v) => { setUnread(v); setPage(1); }} label="Unread only" />
          <Button variant="secondary" className="px-3 py-1.5" icon={CheckCheck} onClick={() => act(() => api.patch('/notifications/read-all'))}>
            <span className="hidden sm:inline">Mark all read</span>
          </Button>
        </div>
      }
    >
      {loading && !data && <div className="flex justify-center py-12"><Spinner /></div>}
      {data?.length === 0 && <EmptyState icon={Bell} title="No notifications" />}
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {(data || []).map((n) => (
          <li key={n._id} className={cn('flex gap-4 px-5 py-4', !n.isRead && 'bg-brand-50/50 dark:bg-brand-500/5')}>
            <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-brand-600')} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900 dark:text-white">{n.title}</p>
                <span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
              {n.link && <Link to={n.link} className="mt-1 inline-block text-xs font-semibold text-brand-600">Open →</Link>}
            </div>
            <div className="flex shrink-0 gap-1">
              {!n.isRead && (
                <button className="btn-ghost p-1.5" title="Mark read" onClick={() => act(() => api.patch(`/notifications/${n._id}/read`))}>
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button className="btn-ghost p-1.5" title="Delete" onClick={() => act(() => api.delete(`/notifications/${n._id}`))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Pagination meta={meta} onPage={setPage} />
    </Card>
  );
}

const CH = { sent: 'paid', logged: 'pending', failed: 'failed', skipped: 'expired' };

function SentLog() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const { data, meta, loading } = useFetch('/notifications/sent', { page, type });
  return (
    <Card
      padded={false}
      title="Delivery log"
      action={
        <Select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          placeholder="All types"
          options={['expiry_reminder', 'renewal_reminder', 'membership_expired', 'payment_confirmation', 'payment_refund', 'event', 'welcome', 'announcement']}
          className="w-48"
        />
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Member</th>
              <th>Type</th>
              <th>Title</th>
              <th><Mail className="inline h-4 w-4" /> Email</th>
              <th><MessageCircle className="inline h-4 w-4" /> WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((n) => (
              <tr key={n._id}>
                <td className="text-slate-500">{dateTime(n.createdAt)}</td>
                <td>{n.member ? <Link className="font-semibold hover:text-brand-600" to={`/members/${n.member._id}`}>{fullName(n.member)}</Link> : '—'}</td>
                <td className="text-xs">{label(n.type)}</td>
                <td className="max-w-xs truncate">{n.title}</td>
                <td><Badge status={CH[n.channels?.email?.status]}>{n.channels?.email?.status}</Badge></td>
                <td><Badge status={CH[n.channels?.whatsapp?.status]}>{n.channels?.whatsapp?.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && !data && <div className="flex justify-center py-12"><Spinner /></div>}
      {data?.length === 0 && <EmptyState title="Nothing sent yet" />}
      <Pagination meta={meta} onPage={setPage} />
    </Card>
  );
}

export default function Notifications() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', audience: 'active', email: true, whatsapp: false });
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/notifications/broadcast', form);
      toast.success(r.data.message);
      setOpen(false);
      setForm({ ...form, title: '', message: '' });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={isAdmin ? 'Your inbox, member announcements and the delivery log.' : 'Reminders, receipts and club announcements.'}
        actions={isAdmin && <Button icon={Megaphone} onClick={() => setOpen(true)}>New announcement</Button>}
      />
      {isAdmin && (
        <div className="mb-5">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'inbox', label: 'My inbox' }, { value: 'sent', label: 'Sent to members' }]} />
        </div>
      )}
      {tab === 'inbox' ? <Inbox /> : <SentLog />}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="broadcast" icon={Send} loading={busy}>Send</Button>
          </>
        }
      >
        <form id="broadcast" onSubmit={send} className="space-y-4">
          <Select
            label="Audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            options={[
              { value: 'active', label: 'Active members' },
              { value: 'expiring', label: 'Expiring within 7 days' },
              { value: 'expired', label: 'Expired members' },
              { value: 'all', label: 'Everyone (except cancelled)' },
            ]}
          />
          <Input label="Title" required maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Message" required maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <Toggle checked={form.email} onChange={(v) => setForm({ ...form, email: v })} label="Also send by email" />
          <Toggle checked={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} label="Also send on WhatsApp" description="Requires WhatsApp to be enabled in Settings." />
        </form>
      </Modal>
    </>
  );
}
