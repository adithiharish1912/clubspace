import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, CircleDashed, Save } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { assetUrl, errMsg } from '../../api/client';
import { Button, Card, ErrorBox, Input, PageHeader, PageLoader, Textarea, Toggle } from '../../components/ui';

const INTEGRATIONS = [
  ['razorpay', 'Razorpay payments', 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET'],
  ['cloudinary', 'Cloudinary image storage', 'CLOUDINARY_* variables'],
  ['email', 'Email (SMTP)', 'SMTP_HOST / SMTP_USER / SMTP_PASS'],
  ['whatsapp', 'WhatsApp Cloud API', 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID'],
];

export default function Settings() {
  const { data, loading, error, reload } = useFetch('/settings');
  const [form, setForm] = useState(null);
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...data.settings, reminderDaysBefore: (data.settings.reminderDaysBefore || []).join(', ') });
  }, [data]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    ['clubName', 'tagline', 'email', 'phone', 'address', 'website', 'gstNumber', 'currency', 'membershipIdPrefix', 'receiptPrefix', 'reminderDaysBefore', 'openingTime', 'closingTime'].forEach((k) =>
      fd.append(k, form[k] ?? '')
    );
    fd.append('emailNotifications', form.emailNotifications);
    fd.append('whatsappNotifications', form.whatsappNotifications);
    if (logo) fd.append('logo', logo);
    try {
      await api.patch('/settings', fd);
      toast.success('Settings saved');
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <PageHeader title="Settings" subtitle="Club profile, numbering, reminders and integrations." actions={<Button type="submit" icon={Save} loading={saving}>Save settings</Button>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Club profile">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Club name" required value={form.clubName} onChange={set('clubName')} />
              <Input label="Tagline" value={form.tagline || ''} onChange={set('tagline')} />
              <Input label="Email" type="email" value={form.email || ''} onChange={set('email')} />
              <Input label="Phone" value={form.phone || ''} onChange={set('phone')} />
              <Input label="Website" value={form.website || ''} onChange={set('website')} />
              <Input label="GSTIN" value={form.gstNumber || ''} onChange={set('gstNumber')} />
              <Textarea label="Address (printed on receipts)" className="sm:col-span-2" value={form.address || ''} onChange={set('address')} />
              <Input label="Opening time" type="time" value={form.openingTime || ''} onChange={set('openingTime')} />
              <Input label="Closing time" type="time" value={form.closingTime || ''} onChange={set('closingTime')} />
              <label className="block sm:col-span-2">
                <span className="label">Logo</span>
                <div className="flex items-center gap-4">
                  {form.logo?.url && <img src={assetUrl(form.logo.url)} alt="Logo" className="h-12 w-12 rounded-xl object-cover" />}
                  <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files[0])} className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-brand-700" />
                </div>
              </label>
            </div>
          </Card>
          <Card title="Numbering & reminders">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Member ID prefix" maxLength={6} value={form.membershipIdPrefix} onChange={set('membershipIdPrefix')} hint="e.g. CS → CS-2026-00001" />
              <Input label="Receipt prefix" maxLength={8} value={form.receiptPrefix} onChange={set('receiptPrefix')} hint="e.g. RCPT-2026-000001" />
              <Input label="Currency" value={form.currency} onChange={set('currency')} />
              <Input label="Remind members N days before expiry" className="sm:col-span-3" value={form.reminderDaysBefore} onChange={set('reminderDaysBefore')} hint="Comma separated, e.g. 7, 3, 1" />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Notification channels">
            <div className="space-y-5">
              <Toggle checked={form.emailNotifications} onChange={(v) => setForm({ ...form, emailNotifications: v })} label="Email notifications" description="Receipts, reminders and announcements by email." />
              <Toggle checked={form.whatsappNotifications} onChange={(v) => setForm({ ...form, whatsappNotifications: v })} label="WhatsApp notifications" description="Requires WhatsApp Cloud API credentials on the server." />
            </div>
          </Card>
          <Card title="Integrations">
            <ul className="space-y-4">
              {INTEGRATIONS.map(([k, name, env]) => (
                <li key={k} className="flex items-start gap-3">
                  {data.integrations[k] ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <CircleDashed className="mt-0.5 h-5 w-5 text-slate-400" />}
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-slate-500">{data.integrations[k] ? 'Connected' : `Not configured · set ${env}`}</p>
                  </div>
                </li>
              ))}
            </ul>
            {data.integrations.demoPayments && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">Payments are running in DEMO mode (development only).</p>}
            <p className="mt-4 text-xs text-slate-500">API keys live in the server's environment variables and are never shown in the browser.</p>
          </Card>
        </div>
      </div>
    </form>
  );
}
