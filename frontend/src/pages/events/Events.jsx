import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin, Plus, Users } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { assetUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, EmptyState, ErrorBox, PageHeader, Pagination, Spinner, Tabs } from '../../components/ui';
import { dateTime, money } from '../../utils/format';
import EventForm from './EventForm';

export function EventBanner({ event, className = 'h-40' }) {
  const url = assetUrl(event.banner?.url);
  return url ? (
    <img src={url} alt="" className={`${className} w-full object-cover`} />
  ) : (
    <div className={`${className} relative flex w-full items-end overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-ink-800 p-4`}>
      <CalendarDays className="absolute -right-4 -top-4 h-32 w-32 text-white/10" />
      <span className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{event.category}</span>
    </div>
  );
}

export default function Events() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const params = tab === 'upcoming' ? { upcoming: 'true' } : tab === 'past' ? { status: 'completed' } : {};
  const { data, meta, loading, error, reload } = useFetch('/events', { ...params, page });

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Club events, schedules and registrations."
        actions={isAdmin && <Button icon={Plus} onClick={() => setFormOpen(true)}>New event</Button>}
      />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={(v) => { setTab(v); setPage(1); }}
          tabs={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>}
      {data?.length === 0 && <div className="card"><EmptyState icon={CalendarDays} title="No events" message={tab === 'upcoming' ? 'Nothing scheduled yet.' : undefined} /></div>}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {(data || []).map((e) => (
          <Link key={e._id} to={`/events/${e._id}`} className="card group animate-fade-up overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
            <EventBanner event={e} />
            <div className="p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge status={e.status} />
                {e.myRegistration && <Badge status={e.myRegistration.status}>{e.myRegistration.status === 'registered' ? 'You’re in' : 'Payment due'}</Badge>}
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 dark:text-white">{e.title}</h3>
              <div className="mt-3 space-y-1.5 text-sm text-slate-500">
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateTime(e.startDate)}</p>
                {e.venue && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{e.venue}</p>}
                <p className="flex items-center gap-2"><Users className="h-4 w-4" />{e.registeredCount}{e.capacity ? ` / ${e.capacity}` : ''} registered</p>
              </div>
              <p className="mt-4 text-lg font-extrabold text-brand-700 dark:text-brand-300">{e.fee ? money(e.fee) : 'Free'}</p>
            </div>
          </Link>
        ))}
      </div>
      {meta && <div className="mt-4"><Pagination meta={meta} onPage={setPage} /></div>}
      <EventForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={(ev) => navigate(`/events/${ev._id}`)} />
    </>
  );
}
