import { useState } from 'react';
import toast from 'react-hot-toast';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { errMsg, fieldErrors } from '../../api/client';
import PlanCard from '../../components/PlanCard';
import { Button, ConfirmDialog, EmptyState, ErrorBox, Input, Modal, PageHeader, PageLoader, Select, Textarea, Toggle } from '../../components/ui';

const DAYS = { monthly: 30, quarterly: 90, 'half-yearly': 180, annual: 365 };
const EMPTY = { name: '', code: '', description: '', durationType: 'monthly', durationDays: 30, price: '', taxPercent: 18, features: '', isPremium: false, isActive: true, color: '#2563eb', sortOrder: 0 };

export default function Plans() {
  const { data, loading, error, reload } = useFetch('/plans', { all: 'true' });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  const open = (plan) => {
    setErrors({});
    setForm(plan ? { ...plan, features: (plan.features || []).join('\n') } : EMPTY);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      name: form.name, code: form.code, description: form.description, durationType: form.durationType,
      durationDays: Number(form.durationDays), price: Number(form.price), taxPercent: Number(form.taxPercent || 0),
      features: form.features.split('\n').map((s) => s.trim()).filter(Boolean),
      isPremium: form.isPremium, isActive: form.isActive, color: form.color, sortOrder: Number(form.sortOrder || 0),
    };
    try {
      if (form._id) await api.patch(`/plans/${form._id}`, body);
      else await api.post('/plans', body);
      toast.success('Plan saved');
      setForm(null);
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      const r = await api.delete(`/plans/${del._id}`);
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
      <PageHeader
        title="Membership plans"
        subtitle="Monthly, quarterly, half-yearly, annual, premium and custom plans."
        actions={<Button icon={Plus} onClick={() => open(null)}>New plan</Button>}
      />
      {data.length === 0 ? (
        <div className="card">
          <EmptyState icon={Layers} title="No plans yet" message="Create your first membership plan." action={<Button icon={Plus} onClick={() => open(null)}>New plan</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <PlanCard key={p._id} plan={p}>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" icon={Pencil} onClick={() => open(p)}>
                  Edit
                </Button>
                <Button variant="secondary" icon={Trash2} onClick={() => setDel(p)} aria-label="Delete plan" />
              </div>
            </PlanCard>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?._id ? `Edit ${form.name}` : 'New plan'}
        size="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
            <Button type="submit" form="plan-form" loading={saving}>Save plan</Button>
          </>
        }
      >
        {form && (
          <form id="plan-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Name *" required value={form.name} onChange={set('name')} error={errors.name} />
            <Input label="Code *" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} error={errors.code} hint="Short unique code, e.g. GOLD12" />
            <Select
              label="Duration type"
              value={form.durationType}
              onChange={(e) => setForm({ ...form, durationType: e.target.value, durationDays: DAYS[e.target.value] || form.durationDays })}
              options={['monthly', 'quarterly', 'half-yearly', 'annual', 'custom']}
            />
            <Input label="Duration (days) *" type="number" min="1" required value={form.durationDays} onChange={set('durationDays')} error={errors.durationDays} />
            <Input label="Price (₹, before tax) *" type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} error={errors.price} />
            <Input label="Tax / GST %" type="number" min="0" max="50" step="0.01" value={form.taxPercent} onChange={set('taxPercent')} />
            <Textarea label="Description" className="sm:col-span-2" value={form.description || ''} onChange={set('description')} />
            <Textarea label="Features (one per line)" className="sm:col-span-2" value={form.features} onChange={set('features')} />
            <label className="block">
              <span className="label">Accent colour</span>
              <input type="color" value={form.color} onChange={set('color')} className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-ink-700" />
            </label>
            <Input label="Display order" type="number" value={form.sortOrder} onChange={set('sortOrder')} />
            <div className="space-y-4 sm:col-span-2">
              <Toggle checked={form.isPremium} onChange={(v) => setForm({ ...form, isPremium: v })} label="Premium plan" description="Highlighted with a dark premium card." />
              <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" description="Inactive plans are hidden from members." />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(del)}
        onClose={() => setDel(null)}
        onConfirm={remove}
        danger
        title="Delete plan?"
        confirmText="Delete"
        message="Plans that already have subscriptions are deactivated instead of deleted, so member history stays intact."
      />
    </>
  );
}
