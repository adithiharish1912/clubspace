import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg, fieldErrors } from '../../api/client';
import { Button, Input, Modal, Select, Textarea, Toggle } from '../../components/ui';
import { money, toInputDate } from '../../utils/format';

const EMPTY = {
  firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '', occupation: '',
  address: { line1: '', city: '', state: '', pincode: '' },
  emergencyContact: { name: '', phone: '', relation: '' },
  notes: '', planId: '', createLogin: true, password: '',
};

/** Create / edit member modal. `member` = existing member for edit mode. */
export default function MemberForm({ open, onClose, member, onSaved }) {
  const editing = Boolean(member);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [plans, setPlans] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setPhoto(null);
    setForm(
      member
        ? {
            ...EMPTY,
            ...member,
            dateOfBirth: toInputDate(member.dateOfBirth),
            address: { ...EMPTY.address, ...(member.address || {}) },
            emergencyContact: { ...EMPTY.emergencyContact, ...(member.emergencyContact || {}) },
          }
        : EMPTY
    );
    if (!member) api.get('/plans').then((r) => setPlans(r.data.data)).catch(() => {});
  }, [open, member]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setNested = (group, k) => (e) => setForm({ ...form, [group]: { ...form[group], [k]: e.target.value } });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone,
        gender: form.gender, dateOfBirth: form.dateOfBirth || undefined, occupation: form.occupation,
        address: form.address, emergencyContact: form.emergencyContact, notes: form.notes,
      };
      let saved;
      if (editing) {
        saved = (await api.patch(`/members/${member._id}`, payload)).data.data;
      } else {
        const r = await api.post('/members', { ...payload, planId: form.planId || undefined, createLogin: form.createLogin, password: form.password || undefined });
        saved = r.data.data.member;
      }
      if (photo) {
        const fd = new FormData();
        fd.append('photo', photo);
        saved = (await api.post(`/members/${saved._id}/photo`, fd)).data.data;
      }
      toast.success(editing ? 'Member updated' : `Member ${saved.membershipId} created`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${member.membershipId}` : 'New member'}
      size="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-form" loading={saving}>
            {editing ? 'Save changes' : 'Create member'}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name *" required value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
          <Input label="Last name" value={form.lastName} onChange={set('lastName')} />
          <Input label="Email *" type="email" required value={form.email} onChange={set('email')} error={errors.email} />
          <Input label="Phone *" type="tel" required value={form.phone} onChange={set('phone')} error={errors.phone} />
          <Select label="Gender" value={form.gender} onChange={set('gender')} placeholder="—" options={['male', 'female', 'other']} />
          <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} error={errors.dateOfBirth} />
          <Input label="Occupation" value={form.occupation || ''} onChange={set('occupation')} />
          <label className="block">
            <span className="label">Profile photo</span>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-brand-700" />
          </label>
        </section>

        <section>
          <p className="mb-3 text-sm font-bold">Address</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Street" className="sm:col-span-2" value={form.address.line1} onChange={setNested('address', 'line1')} />
            <Input label="City" value={form.address.city} onChange={setNested('address', 'city')} />
            <Input label="State" value={form.address.state} onChange={setNested('address', 'state')} />
            <Input label="PIN code" value={form.address.pincode} onChange={setNested('address', 'pincode')} />
          </div>
        </section>

        <section>
          <p className="mb-3 text-sm font-bold">Emergency contact</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Name" value={form.emergencyContact.name} onChange={setNested('emergencyContact', 'name')} />
            <Input label="Phone" value={form.emergencyContact.phone} onChange={setNested('emergencyContact', 'phone')} />
            <Input label="Relation" value={form.emergencyContact.relation} onChange={setNested('emergencyContact', 'relation')} />
          </div>
        </section>

        {!editing && (
          <section className="space-y-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <Select
              label="Membership plan (payment collected afterwards)"
              value={form.planId}
              onChange={set('planId')}
              placeholder="Assign later"
              options={plans.map((p) => ({ value: p._id, label: `${p.name} – ${money(p.totalPrice)} / ${p.durationDays} days` }))}
            />
            <Toggle checked={form.createLogin} onChange={(v) => setForm({ ...form, createLogin: v })} label="Create member login" description="Lets the member log in to see their card, pay online and register for events." />
            {form.createLogin && (
              <Input label="Initial password (optional)" type="text" value={form.password} onChange={set('password')} error={errors.password} hint="Leave blank – the member can use “Forgot password” to set one." />
            )}
          </section>
        )}

        <Textarea label="Internal notes" value={form.notes || ''} onChange={set('notes')} />
      </form>
    </Modal>
  );
}
