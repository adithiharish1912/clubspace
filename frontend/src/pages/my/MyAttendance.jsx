import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { Badge, Card, EmptyState, PageHeader, Pagination, Spinner } from '../../components/ui';
import { date, time } from '../../utils/format';

export default function MyAttendance() {
  const [page, setPage] = useState(1);
  const { data, meta, loading } = useFetch('/attendance', { page, limit: 20 });
  return (
    <>
      <PageHeader title="My attendance" subtitle="Every check-in and check-out at the club." />
      <Card padded={false}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((a) => (
                <tr key={a._id}>
                  <td className="font-semibold">{date(a.checkIn)}</td>
                  <td>{time(a.checkIn)}</td>
                  <td>{a.checkOut ? time(a.checkOut) : <Badge status="active">Inside</Badge>}</td>
                  <td>{a.durationMinutes ? `${Math.floor(a.durationMinutes / 60)}h ${a.durationMinutes % 60}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && !data && <div className="flex justify-center py-12"><Spinner /></div>}
        {data?.length === 0 && <EmptyState icon={ClipboardCheck} title="No visits yet" message="Show your membership QR at the front desk to check in." />}
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
