import { useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, KeyRound, Save } from 'lucide-react';
import api, { errMsg, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Badge, Button, Card, Input, PageHeader } from '../../components/ui';

export default function Profile() {
  const { user, member, setUser, setToken, refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '', ...(member?.address || {}) });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try {
      const r = await api.patch('/auth/profile', form);
      if (member) await api.patch(`/members/${member._id}`, { address });
      setUser(r.data.data.user);
      refresh();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setBusy('avatar');
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const r = await api.patch('/auth/profile', fd);
      setUser(r.data.data.user);
      refresh();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return setErrors({ confirm: 'Passwords do not match' });
    setBusy('pw');
    setErrors({});
    try {
      const r = await api.patch('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setToken(r.data.data.token);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed – other sessions have been signed out');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setBusy('');
    }
    return null;
  };

  return (
    <>
      <PageHeader title="My profile" subtitle="Your personal details and password." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="text-center">
          <div className="relative mx-auto w-fit">
            <Avatar src={user.avatar?.url} name={user.name} size="h-28 w-28" className="text-2xl" />
            <label className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700" title="Change photo">
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files[0])} disabled={busy === 'avatar'} />
            </label>
          </div>
          <p className="mt-4 text-lg font-bold">{user.name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="mt-2 flex justify-center gap-2">
            <Badge status={user.role} />
            {user.isEmailVerified && <Badge status="active">Verified</Badge>}
          </div>
          {member && <p className="mt-4 font-mono text-sm">{member.membershipId}</p>}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Personal details">
            <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={Boolean(member)} hint={member ? 'Contact the club office to change your name' : undefined} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {member && (
                <>
                  <Input label="Street" className="sm:col-span-2" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
                  <Input label="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                  <Input label="PIN code" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} />
                </>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" icon={Save} loading={busy === 'profile'}>Save details</Button>
              </div>
            </form>
          </Card>
          <Card title="Change password">
            <form onSubmit={changePassword} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Current password" type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />
              <Input label="New password" type="password" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={errors.newPassword} autoComplete="new-password" />
              <Input label="Confirm" type="password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={errors.confirm} autoComplete="new-password" />
              <div className="sm:col-span-3">
                <Button type="submit" variant="secondary" icon={KeyRound} loading={busy === 'pw'}>Update password</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
