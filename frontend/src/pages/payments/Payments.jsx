import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Search, Undo2, Wallet } from 'lucide-react';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import api, { download, errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, EmptyState, ErrorBox, Input, Modal, PageHeader, Pagination, Select, Spinner, Tabs, Textarea } from '../../components/ui';
import { date, dateTime, fullName, money } from '../../utils/format';
import RecordPaymentModal from '../../components/RecordPaymentModal';

function PaymentsTable() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const debounced = useDebounce(q);
  const [filters, setFilters] = useState({ status: '', method: '', purpose: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [refund, setRefund] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '' });
  const [busy, setBusy] = useState(false);

  const tab = params.get('tab') || 'all';
  const status = tab === 'pending' ? 'pending' : tab === 'refunds' ? 'refunded' : filters.status;
  const { data, meta, loading, error, reload } = useFetch('/payments', { ...filters, status, q: debounced, page, limit: 15 });
  const setF = (k) => (e) => {
    setFilters({ ...filters, [k]: e.target.value });
    setPage(1);
  };

  const doRefund = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${refund._id}/refund`, { amount: refundForm.amount ? Number(refundForm.amount) : undefined, reason: refundForm.reason });
      toast.success('Refund processed');
      setRefund(null);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={(v) => {
            setParams(v === 'all' ? {} : { tab: v });
            setPage(1);
          }}
          tabs={[
            { value: 'all', label: 'All transactions' },
            { value: 'pending', label: 'Pending / unfinished' },
            { value: 'refunds', label: 'Refunds' },
          ]}
        />
        {meta && (
          <p className="text-sm text-slate-500">
            Collected <b className="text-slate-900 dark:text-white">{money(meta.gross)}</b> · Refunded <b className="text-rose-600">{money(meta.refunded)}</b> · Net{' '}
            <b className="text-emerald-600">{money(meta.net)}</b>
          </p>
        )}
      </div>

      <Card padded={false}>
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 lg:grid-cols-6 dark:border-white/5">
          <Input icon={Search} placeholder="Receipt / Razorpay ID" value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2" />
          {tab === 'all' && <Select value={filters.status} onChange={setF('status')} placeholder="All statuses" options={['paid', 'created', 'failed', 'partially_refunded', 'refunded']} />}
          <Select value={filters.method} onChange={setF('method')} placeholder="All methods" options={['razorpay', 'cash', 'upi', 'card', 'bank_transfer', 'cheque', 'coupon', 'demo']} />
          <Input type="date" value={filters.from} onChange={setF('from')} aria-label="From date" />
          <Input type="date" value={filters.to} onChange={setF('to')} aria-label="To date" />
        </div>
        {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Receipt</th>
                <th className="hidden lg:table-cell">Description</th>
                <th>Method</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data || []).map((p) => (
                <tr key={p._id}>
                  <td className="text-slate-500">{dateTime(p.paidAt || p.createdAt)}</td>
                  <td>
                    {p.member ? (
                      <Link to={`/members/${p.member._id}`} className="font-semibold hover:text-brand-600">
                        {fullName(p.member)}
                      </Link>
                    ) : '—'}
                    <p className="font-mono text-xs text-slate-400">{p.member?.membershipId}</p>
                  </td>
                  <td className="font-mono text-xs">{p.receiptNo || '—'}</td>
                  <td className="hidden max-w-xs truncate lg:table-cell">{p.description}</td>
                  <td className="capitalize">{p.method.replace('_', ' ')}</td>
                  <td><Badge status={p.status} /></td>
                  <td className="text-right font-bold">
                    {money(p.amount)}
                    {p.refundedAmount > 0 && <p className="text-xs font-medium text-rose-600">−{money(p.refundedAmount)}</p>}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.receiptNo && (
                        <button className="btn-ghost p-1.5" title="Receipt" onClick={() => download(`/payments/${p._id}/receipt`, null, `${p.receiptNo}.pdf`)}>
                          <Download className="h-4 w-4" />
                        </button>
                      )}
                      {isAdmin && ['paid', 'partially_refunded'].includes(p.status) && (
                        <button
                          className="btn-ghost p-1.5 text-rose-600"
                          title="Refund"
                          onClick={() => {
                            setRefund(p);
                            setRefundForm({ amount: String(p.amount - p.refundedAmount), reason: '' });
                          }}
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && !data && <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>}
        {data?.length === 0 && <EmptyState icon={Wallet} title="No payments found" />}
        <Pagination meta={meta} onPage={setPage} />
      </Card>

      <Modal
        open={Boolean(refund)}
        onClose={() => setRefund(null)}
        title={`Refund ${refund?.receiptNo || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefund(null)}>Cancel</Button>
            <Button variant="danger" onClick={doRefund} loading={busy} disabled={!refundForm.reason}>Process refund</Button>
          </>
        }
      >
        {refund && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Paid {money(refund.amount)} on {date(refund.paidAt)} via {refund.method}. Refundable: <b>{money(refund.amount - refund.refundedAmount)}</b>.
              {refund.method === 'razorpay' ? ' The amount is returned to the original payment source through Razorpay.' : ' Return the money to the member manually; this records it in the books.'}
            </p>
            <Input label="Amount" type="number" step="0.01" min="0.01" max={refund.amount - refund.refundedAmount} value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })} />
            <Textarea label="Reason *" required value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} />
            <p className="text-xs text-slate-500">A full refund of a membership payment cancels that subscription.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Subscriptions awaiting payment – staff can collect at the counter. */
function PendingSubscriptions() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, reload } = useFetch('/subscriptions', { status: 'pending', page, limit: 15 });
  const [collect, setCollect] = useState(null);
  return (
    <Card title="Memberships awaiting payment" padded={false} className="mb-6">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Member</th>
              <th>Plan</th>
              <th>Type</th>
              <th className="text-right">Amount due</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data || []).map((s) => (
              <tr key={s._id}>
                <td className="text-slate-500">{date(s.createdAt)}</td>
                <td>
                  <Link to={`/members/${s.member?._id}`} className="font-semibold hover:text-brand-600">{fullName(s.member)}</Link>
                  <p className="font-mono text-xs text-slate-400">{s.member?.membershipId}</p>
                </td>
                <td>{s.planSnapshot?.name}</td>
                <td className="capitalize">{s.type}</td>
                <td className="text-right font-bold">{money(s.amount)}</td>
                <td className="text-right">
                  <Button variant="secondary" className="px-3 py-1.5" onClick={() => setCollect(s)}>Collect</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && !data && <div className="flex justify-center py-10"><Spinner /></div>}
      {data?.length === 0 && <EmptyState title="Nothing pending" message="All memberships are paid up." />}
      <Pagination meta={meta} onPage={setPage} />
      <RecordPaymentModal open={Boolean(collect)} onClose={() => setCollect(null)} member={collect?.member} subscription={collect} onDone={reload} />
    </Card>
  );
}

export default function Payments() {
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader title="Payments" subtitle="Transactions, receipts, pending payments and refunds." />
      {params.get('tab') === 'pending' && <PendingSubscriptions />}
      <PaymentsTable />
    </>
  );
}
