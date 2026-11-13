import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote } from 'lucide-react';
import api, { errMsg } from '../api/client';
import { Button, Input, Modal, Select } from './ui';
import { money } from '../utils/format';

/**
 * Staff-side: collect a counter payment (cash / UPI / card…) for a member.
 * Pass `subscription` to settle a pending subscription, otherwise pick a plan (new / renewal).
 */
export default function RecordPaymentModal({ open, onClose, member, subscription, onDone }) {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ planId: '', method: 'cash', referenceNo: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ planId: '', method: 'cash', referenceNo: '' });
    if (!subscription) api.get('/plans').then((r) => setPlans(r.data.data)).catch(() => {});
  }, [open, subscription]);

  const plan = plans.find((p) => p._id === form.planId);
  const amount = subscription ? subscription.amount : plan?.totalPrice;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = subscription
        ? { subscriptionId: subscription._id, method: form.method, referenceNo: form.referenceNo }
        : { memberId: member._id, planId: form.planId, method: form.method, referenceNo: form.referenceNo };
      const r = await api.post('/payments/offline', body);
      toast.success(`Payment recorded · ${r.data.data.receiptNo}`);
      onDone?.(r.data.data);
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subscription ? 'Collect payment' : member?.status === 'active' ? 'Renew membership' : 'Activate membership'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pay-form" loading={saving} icon={Banknote} disabled={!amount}>
            Record {amount ? money(amount) : 'payment'}
          </Button>
        </>
      }
    >
      <form id="pay-form" onSubmit={submit} className="space-y-4">
        {subscription ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/5">
            <p className="font-semibold">{subscription.planSnapshot.name} plan</p>
            <p className="text-slate-500">{subscription.planSnapshot.durationDays} days · {subscription.type}</p>
          </div>
        ) : (
          <Select
            label="Plan"
            required
            value={form.planId}
            onChange={(e) => setForm({ ...form, planId: e.target.value })}
            placeholder="Select a plan"
            options={plans.map((p) => ({ value: p._id, label: `${p.name} · ${p.durationDays} days · ${money(p.totalPrice)}` }))}
          />
        )}
        <Select
          label="Payment method"
          value={form.method}
          onChange={(e) => setForm({ ...form, method: e.target.value })}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'upi', label: 'UPI' },
            { value: 'card', label: 'Card (POS)' },
            { value: 'bank_transfer', label: 'Bank transfer' },
            { value: 'cheque', label: 'Cheque' },
          ]}
        />
        <Input label="Reference no. (UPI txn / cheque no.)" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} />
        {member?.status === 'active' && !subscription && (
          <p className="text-xs text-slate-500">Renewal days are added after the current expiry date, so the member loses nothing.</p>
        )}
      </form>
    </Modal>
  );
}
