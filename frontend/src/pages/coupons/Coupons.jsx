import { useState } from 'react';
import toast from 'react-hot-toast';
import { BadgePercent, Pencil, Plus, Trash2 } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { errMsg, fieldErrors } from '../../api/client';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Textarea, Toggle } from '../../components/ui';
import { date, toInputDate } from '../../utils/format';

const TYPE_LABEL = { first_month_free: 'First month free', percent: '% off', flat: '₹ off' };
const EMPTY = { code: '', description: '', type: 'first_month_free', value: '', maxUses: '', validUntil: '', newMembersOnly: true, oncePerMember: true, isActive: true };

const describe = (c) => (c.type === 'first_month_free' ? 'First month free' : c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`);

export default function Coupons() {
  const { data, loading, error, reload } = useFetch('/coupons');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  const open = (c) => {
    setErrors({});
    setForm(c ? { ...EMPTY, ...c, value: c.value ?? '', maxUses: c.maxUses || '', validUntil: toInputDate(c.validUntil) } : EMPTY);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      code: form.code.trim().toUpperCase(),
      description: form.description,
      type: form.type,
      value: form.type === 'first_month_free' ? 0 : Number(form.value || 0),
      maxUses: Number(form.maxUses || 0),
      validUntil: form.validUntil || '',
      newMembersOnly: form.newMembersOnly,
      oncePerMember: form.oncePerMember,
      isActive: form.isActive,
    };
    try {
      if (form._id) await api.patch(`/coupons/${form._id}`, body);
      else await api.post('/coupons', body);
      toast.success('Coupon saved');
      setForm(null);
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    try {
      await api.patch(`/coupons/${c._id}`, { isActive: !c.isActive });
      toast.success(c.isActive ? 'Coupon switched off' : 'Coupon switched on');
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async () => {
    try {
      const r = await api.delete(`/coupons/${del._id}`);
      toast.success(r.data.message);
      setDel(null);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Coupons" subtitle="Discount codes members can enter when they pay." actions={<Button icon={Plus} onClick={() => open(null)}>New coupon</Button>} />

      {data.length === 0 ? (
        <div className="card">
          <EmptyState icon={BadgePercent} title="No coupons yet" action={<Button icon={Plus} onClick={() => open(null)}>New coupon</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Card key={c._id} className={c.isActive ? '' : 'opacity-70'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-lg font-extrabold text-slate-900 dark:text-white">{c.code}</p>
                  <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">{describe(c)}</p>
                </div>
                <Badge status={c.isActive ? 'active' : 'expired'}>{c.isActive ? 'On' : 'Off'}</Badge>
              </div>
              {c.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{c.description}</p>}
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-semibold uppercase text-slate-400">Used</dt>
                  <dd className="text-sm font-bold">
                    {c.usedCount}
                    {c.maxUses ? ` / ${c.maxUses}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase text-slate-400">Valid till</dt>
                  <dd className="text-sm font-bold">{c.validUntil ? date(c.validUntil) : 'No end date'}</dd>
                </div>
                <div className="col-span-2 text-slate-500">
                  {c.newMembersOnly ? 'New members only' : 'All members'} · {c.oncePerMember ? 'once per member' : 'reusable'}
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => toggle(c)}>
                  {c.isActive ? 'Switch off' : 'Switch on'}
                </Button>
                <Button variant="secondary" icon={Pencil} onClick={() => open(c)} aria-label="Edit coupon" />
                <Button variant="secondary" icon={Trash2} onClick={() => setDel(c)} aria-label="Delete coupon" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?._id ? `Edit ${form.code}` : 'New coupon'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
            <Button type="submit" form="coupon-form" loading={saving}>Save coupon</Button>
          </>
        }
      >
        {form && (
          <form id="coupon-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Code *" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} error={errors.code} hint="Members type this, e.g. FREEMEMBERSHIP500" className="sm:col-span-2" />
            <Select
              label="Discount"
              value={form.type}
              onChange={set('type')}
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
            {form.type !== 'first_month_free' ? (
              <Input label={form.type === 'percent' ? 'Percent off' : 'Amount off (₹)'} type="number" min="0" step="0.01" required value={form.value} onChange={set('value')} error={errors.value} />
            ) : (
              <p className="self-end rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-white/5">One month's price is taken off. On the Monthly plan the first month is free.</p>
            )}
            <Input label="Max uses (0 = unlimited)" type="number" min="0" value={form.maxUses} onChange={set('maxUses')} />
            <Input label="Valid till (optional)" type="date" value={form.validUntil} onChange={set('validUntil')} />
            <Textarea label="Description" className="sm:col-span-2" value={form.description || ''} onChange={set('description')} />
            <div className="space-y-4 sm:col-span-2">
              <Toggle checked={form.newMembersOnly} onChange={(v) => setForm({ ...form, newMembersOnly: v })} label="New members only" description="Only for a member's first membership, not renewals." />
              <Toggle checked={form.oncePerMember} onChange={(v) => setForm({ ...form, oncePerMember: v })} label="Once per member" />
              <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(del)}
        onClose={() => setDel(null)}
        onConfirm={remove}
        danger
        title="Delete coupon?"
        confirmText="Delete"
        message="Coupons that have already been used are switched off instead of deleted, so payment history stays readable."
      />
    </>
  );
}
