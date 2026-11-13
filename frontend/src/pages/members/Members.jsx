import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Users } from 'lucide-react';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Input, PageHeader, Pagination, Select, Spinner } from '../../components/ui';
import { date, fullName } from '../../utils/format';
import MemberForm from './MemberForm';

export default function Members() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get('q') || '');
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const debounced = useDebounce(q);
  const status = params.get('status') || '';
  const expiring = params.get('expiring') || '';
  const gender = params.get('gender') || '';
  const sort = params.get('sort') || '-createdAt';
  const page = Number(params.get('page') || 1);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debounced !== (params.get('q') || '')) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data, meta, loading, error, reload } = useFetch('/members', { q: debounced, status, expiring, gender, sort, page, limit: 12 });

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Search, filter and manage every club member."
        actions={
          <Button icon={UserPlus} onClick={() => setFormOpen(true)}>
            New member
          </Button>
        }
      />
      <Card padded={false}>
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-white/5">
          <Input icon={Search} placeholder="Name, email, phone or member ID" value={q} onChange={(e) => setQ(e.target.value)} className="lg:col-span-2" />
          <Select value={status} onChange={(e) => update({ status: e.target.value, expiring: '' })} placeholder="All statuses" options={['active', 'pending', 'expired', 'suspended', 'cancelled']} />
          <Select
            value={expiring}
            onChange={(e) => update({ expiring: e.target.value, status: '' })}
            placeholder="Any expiry"
            options={[
              { value: '7', label: 'Expiring in 7 days' },
              { value: '15', label: 'Expiring in 15 days' },
              { value: '30', label: 'Expiring in 30 days' },
            ]}
          />
          <Select
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            options={[
              { value: '-createdAt', label: 'Newest first' },
              { value: 'createdAt', label: 'Oldest first' },
              { value: 'firstName', label: 'Name A–Z' },
              { value: 'membershipExpiry', label: 'Expiry (soonest)' },
              { value: 'membershipId', label: 'Member ID' },
            ]}
          />
        </div>

        {error && (
          <div className="p-4">
            <ErrorBox message={error} onRetry={reload} />
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Member ID</th>
                <th className="hidden md:table-cell">Phone</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((m) => (
                <tr key={m._id} className="cursor-pointer" onClick={() => navigate(`/members/${m._id}`)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar src={m.photo?.url} name={fullName(m)} />
                      <div>
                        <Link to={`/members/${m._id}`} className="font-semibold text-slate-900 hover:text-brand-600 dark:text-white" onClick={(e) => e.stopPropagation()}>
                          {fullName(m)}
                        </Link>
                        <p className="text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs">{m.membershipId}</td>
                  <td className="hidden md:table-cell">{m.phone}</td>
                  <td>{m.currentSubscription?.planSnapshot?.name || <span className="text-slate-400">—</span>}</td>
                  <td>
                    <Badge status={m.status} />
                  </td>
                  <td className="text-slate-500">{date(m.membershipExpiry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && !data && (
          <div className="flex justify-center py-12">
            <Spinner className="h-7 w-7" />
          </div>
        )}
        {data && data.length === 0 && (
          <EmptyState icon={Users} title="No members found" message="Try a different search or filter." action={<Button icon={UserPlus} onClick={() => setFormOpen(true)}>Add member</Button>} />
        )}
        <Pagination meta={meta} onPage={(p) => update({ page: String(p) })} />
      </Card>

      <MemberForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (params.get('new')) update({ new: '' });
        }}
        onSaved={(m) => navigate(`/members/${m._id}`)}
      />
    </>
  );
}
