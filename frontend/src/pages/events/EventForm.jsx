import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg, fieldErrors } from '../../api/client';
import { Button, Input, Modal, Select, Textarea, Toggle } from '../../components/ui';
import { toInputDateTime } from '../../utils/format';

const EMPTY = { title: '', description: '', category: 'General', venue: '', startDate: '', endDate: '', registrationDeadline: '', capacity: '', fee: '', status: 'upcoming', membersOnly: true, notifyMembers: true };

export default function EventForm({ open, onClose, event, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [banner, setBanner] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setBanner(null);
    setForm(
      event
        ? { ...EMPTY, ...event, startDate: toInputDateTime(event.startDate), endDate: toInputDateTime(event.endDate), registrationDeadline: toInputDateTime(event.registrationDeadline), capacity: event.capacity || '', fee: event.fee || '', notifyMembers: false }
        : EMPTY
    );
  }, [open, event]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    ['title', 'description', 'category', 'venue', 'status'].forEach((k) => fd.append(k, form[k] || ''));
    ['startDate', 'endDate', 'registrationDeadline'].forEach((k) => form[k] && fd.append(k, new Date(form[k]).toISOString()));
    fd.append('capacity', form.capacity || 0);
    fd.append('fee', form.fee || 0);
    fd.append('membersOnly', form.membersOnly);
    if (!event) fd.append('notifyMembers', form.notifyMembers);
    if (banner) fd.append('banner', banner);
    try {
      const r = event ? await api.patch(`/events/${event._id}`, fd) : await api.post('/events', fd);
      toast.success(event ? 'Event updated' : 'Event created');
      onSaved?.(r.data.data);
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
      title={event ? 'Edit event' : 'New event'}
      size="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="event-form" loading={saving}>Save event</Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Title *" required className="sm:col-span-2" value={form.title} onChange={set('title')} error={errors.title} />
        <Input label="Category" value={form.category} onChange={set('category')} />
        <Input label="Venue" value={form.venue} onChange={set('venue')} />
        <Input label="Starts *" type="datetime-local" required value={form.startDate} onChange={set('startDate')} error={errors.startDate} />
        <Input label="Ends *" type="datetime-local" required value={form.endDate} onChange={set('endDate')} error={errors.endDate} />
        <Input label="Registration closes" type="datetime-local" value={form.registrationDeadline} onChange={set('registrationDeadline')} />
        <Select label="Status" value={form.status} onChange={set('status')} options={['upcoming', 'ongoing', 'completed', 'cancelled']} />
        <Input label="Capacity (0 = unlimited)" type="number" min="0" value={form.capacity} onChange={set('capacity')} />
        <Input label="Fee (₹, 0 = free)" type="number" min="0" step="0.01" value={form.fee} onChange={set('fee')} />
        <Textarea label="Description" className="sm:col-span-2" value={form.description || ''} onChange={set('description')} />
        <label className="block sm:col-span-2">
          <span className="label">Banner image</span>
          <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files[0])} className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-brand-700" />
        </label>
        <div className="space-y-4 sm:col-span-2">
          <Toggle checked={form.membersOnly} onChange={(v) => setForm({ ...form, membersOnly: v })} label="Active members only" />
          {!event && <Toggle checked={form.notifyMembers} onChange={(v) => setForm({ ...form, notifyMembers: v })} label="Notify all active members" description="Sends an in-app notification and email." />}
        </div>
      </form>
    </Modal>
  );
}
