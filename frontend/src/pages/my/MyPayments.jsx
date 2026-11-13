import { useState } from 'react';
import { Download, Wallet } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { download } from '../../api/client';
import { Badge, Card, EmptyState, PageHeader, Pagination, Spinner } from '../../components/ui';
import { dateTime, money } from '../../utils/format';

export default function MyPayments() {
  const [page, setPage] = useState(1);
  const { data, meta, loading } = useFetch('/payments', { page, limit: 15 });
  return (
    <>
      <PageHeader title="My payments" subtitle="Your transaction history and receipts." />
      <Card padded={false}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Receipt</th>
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
                  <td>{p.description}</td>
                  <td className="font-mono text-xs">{p.receiptNo || '—'}</td>
                  <td className="capitalize">{p.method.replace('_', ' ')}</td>
                  <td><Badge status={p.status} /></td>
                  <td className="text-right font-bold">
                    {money(p.amount)}
                    {p.refundedAmount > 0 && <p className="text-xs font-medium text-rose-600">Refunded {money(p.refundedAmount)}</p>}
                  </td>
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
        {loading && !data && <div className="flex justify-center py-12"><Spinner /></div>}
        {data?.length === 0 && <EmptyState icon={Wallet} title="No payments yet" />}
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
