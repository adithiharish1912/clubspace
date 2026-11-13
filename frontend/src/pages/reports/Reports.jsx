import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, ClipboardList, FileSpreadsheet, FileText, IndianRupee, Layers, Receipt, Users } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { download, errMsg } from '../../api/client';
import { Button, Card, EmptyState, ErrorBox, Input, PageHeader, Select, Spinner, cn } from '../../components/ui';
import { todayKey } from '../../utils/format';

const TYPES = [
  { value: 'summary', label: 'Club summary', icon: CalendarClock, desc: 'Daily / monthly / annual overview' },
  { value: 'revenue', label: 'Revenue', icon: IndianRupee, desc: 'Income by day or month, refunds, net' },
  { value: 'payments', label: 'Payments', icon: Receipt, desc: 'Every transaction with receipt numbers' },
  { value: 'members', label: 'Members', icon: Users, desc: 'Member list with plan and expiry' },
  { value: 'subscriptions', label: 'Memberships', icon: Layers, desc: 'New, renewals and pending subscriptions' },
  { value: 'attendance', label: 'Attendance', icon: ClipboardList, desc: 'Check-ins, durations, unique visitors' },
];

export default function Reports() {
  const [type, setType] = useState('summary');
  const [period, setPeriod] = useState('monthly');
  const [day, setDay] = useState(todayKey());
  const [range, setRange] = useState({ from: '', to: '' });
  const [exporting, setExporting] = useState('');

  const params = period === 'custom' ? { period, ...range } : { period, date: day };
  const { data, loading, error, reload } = useFetch(`/reports/${type}`, params);

  const exportAs = async (format) => {
    setExporting(format);
    try {
      await download(`/reports/${type}`, { ...params, format }, `${type}-report.${format}`);
    } catch (err) {
      toast.error(errMsg(err, 'Export failed'));
    } finally {
      setExporting('');
    }
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Generate reports and export them to Excel or PDF."
        actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} loading={exporting === 'xlsx'} onClick={() => exportAs('xlsx')}>Excel</Button>
            <Button icon={FileText} loading={exporting === 'pdf'} onClick={() => exportAs('pdf')}>PDF</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {TYPES.map(({ value, label, icon: Icon, desc }) => (
          <button
            key={value}
            onClick={() => setType(value)}
            className={cn('card p-4 text-left transition hover:-translate-y-0.5', type === value && 'ring-2 ring-brand-500')}
          >
            <Icon className={cn('h-6 w-6', type === value ? 'text-brand-600' : 'text-slate-400')} />
            <p className="mt-2 text-sm font-bold">{label}</p>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{desc}</p>
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Select
            label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'annual', label: 'Annual' },
              { value: 'custom', label: 'Custom range' },
            ]}
          />
          {period === 'custom' ? (
            <>
              <Input label="From" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
              <Input label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </>
          ) : (
            <Input label={period === 'daily' ? 'Day' : period === 'monthly' ? 'Any day in the month' : 'Any day in the year'} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          )}
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {data && (
        <Card title={`${data.title} · ${data.subtitle}`} padded={false}>
          {data.summary?.length > 0 && (
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 p-5 sm:grid-cols-4 dark:border-white/5">
              {data.summary.map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</p>
                  <p className="text-xl font-extrabold">{v}</p>
                </div>
              ))}
            </div>
          )}
          {data.rows.length === 0 ? (
            <EmptyState title="No records for this period" />
          ) : (
            <div className="table-wrap max-h-[60vh]">
              <table className="table">
                <thead className="sticky top-0">
                  <tr>
                    {data.columns.map((c) => (
                      <th key={c.key} className={c.align === 'right' ? 'text-right' : ''}>{c.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={i}>
                      {data.columns.map((c) => (
                        <td key={c.key} className={c.align === 'right' ? 'text-right tabular-nums' : ''}>{r[c.key] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
