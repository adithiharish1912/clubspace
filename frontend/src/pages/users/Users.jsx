import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import api, { errMsg, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Input, Modal, PageHeader, Pagination, Select, Spinner, Toggle } from '../../components/ui';
import { date, dateTime } from '../../utils/format';

export default function Users() {
  const { user: me, isSuper } = useAuth();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const { data, meta, loading, reload } = useFetch('/users', { page, role });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const roles = isSuper ? ['superadmin', 'admin', 'staff'] : ['staff'];

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const body = { name: form.name, phone: form.phone, role: form.role, isActive: form.isActive };
      if (form.password) body.password = form.password;
      if (form._id) await api.patch(`/users/${form._id}`, body);
      else await api.post('/users', { ...body, email: form.email });
      toast.success('User saved');
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
      await api.delete(`/users/${del._id}`);
      toast.success('User deleted');
      setDel(null);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Staff & admins"
        subtitle={isSuper ? 'Manage super admins, club administrators and staff accounts.' : 'Manage front-desk staff accounts.'}
        actions={<Button icon={Plus} onClick={() => { setErrors({}); setForm({ name: '', email: '', phone: '', password: '', role: 'staff', isActive: true }); }}>Add user</Button>}
      />
      <Card padded={false} action={isSuper && <Select value={role} onChange={(e) => setRole(e.target.value)} placeholder="All roles" options={roles} className="w-40" />} title="Accounts">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="hidden md:table-cell">Last login</th>
                <th className="hidden md:table-cell">Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data || []).map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar src={u.avatar?.url} name={u.name} />
                      <div>
                        <p className="font-semibold">{u.name} {u._id === me._id && <span className="text-xs text-slate-400">(you)</span>}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><Badge status={u.role} /></td>
                  <td><Badge status={u.isActive ? 'active' : 'suspended'}>{u.isActive ? 'Active' : 'Disabled'}</Badge></td>
                  <td className="hidden text-slate-500 md:table-cell">{u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never'}</td>
                  <td className="hidden text-slate-500 md:table-cell">{date(u.createdAt)}</td>
                  <td className="text-right">
                    <button className="btn-ghost p-1.5" onClick={() => { setErrors({}); setForm({ ...u, password: '' }); }} title="Edit"><Pencil className="h-4 w-4" /></button>
                    {u._id !== me._id && (
                      <button className="btn-ghost p-1.5 text-rose-600" onClick={() => setDel(u)} title="Delete"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && !data && <div className="flex justify-center py-12"><Spinner /></div>}
        {data?.length === 0 && <EmptyState icon={ShieldCheck} title="No accounts yet" />}
        <Pagination meta={meta} onPage={setPage} />
      </Card>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?._id ? 'Edit user' : 'Add user'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
            <Button type="submit" form="user-form" loading={saving}>Save</Button>
          </>
        }
      >
        {form && (
          <form id="user-form" onSubmit={save} className="space-y-4">
            <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <Input label="Email" type="email" required disabled={Boolean(form._id)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
            <Input label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={roles} disabled={form._id === me._id} />
            <Input
              label={form._id ? 'New password (leave blank to keep)' : 'Password'}
              type="password"
              required={!form._id}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
              autoComplete="new-password"
            />
            {form._id && form._id !== me._id && <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Account active" description="Disabled users cannot log in." />}
          </form>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} onConfirm={remove} danger title="Delete user?" confirmText="Delete" message={`${del?.name} will lose access immediately.`} />
    </>
  );
}
