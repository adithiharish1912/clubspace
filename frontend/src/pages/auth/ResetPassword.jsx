import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthShell from './AuthShell';
import { Button, Input } from '../../components/ui';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (pw.password !== pw.confirm) return setError('Passwords do not match');
    setLoading(true);
    setError('');
    try {
      const r = await api.post(`/auth/reset-password/${token}`, { password: pw.password });
      toast.success(r.data.message);
      if (user) await logout();
      navigate('/login');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
    return null;
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters, including a letter and a number.">
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <Input label="New password" type="password" required value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} autoComplete="new-password" />
        <Input label="Confirm password" type="password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
        <Button type="submit" loading={loading} className="w-full py-3">
          Reset password
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-semibold text-brand-600">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
