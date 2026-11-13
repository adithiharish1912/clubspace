import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthShell from './AuthShell';
import { Button, Input, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { errMsg, fieldErrors } from '../../api/client';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const { confirm, ...payload } = form;
      const res = await register(payload);
      if (res.data.devVerifyUrl) console.info('Dev verification link:', res.data.devVerifyUrl);
      if (res.data.token) {
        toast.success('Account created! Choose a plan to activate your membership.');
        navigate('/my/membership');
      } else {
        toast.success(res.message);
        navigate('/login');
      }
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Become a member" subtitle="Create your account — it takes less than a minute.">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="First name" required value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
        <Input label="Last name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
        <Input label="Email" type="email" required className="sm:col-span-2" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <Input label="Mobile" type="tel" required value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="98XXXXXXXX" />
        <Select label="Gender" value={form.gender} onChange={set('gender')} placeholder="Prefer not to say" options={['male', 'female', 'other']} />
        <Input label="Date of birth" type="date" className="sm:col-span-2" value={form.dateOfBirth} onChange={set('dateOfBirth')} error={errors.dateOfBirth} />
        <Input label="Password" type="password" required value={form.password} onChange={set('password')} error={errors.password} hint="8+ chars with a letter and a number" autoComplete="new-password" />
        <Input label="Confirm password" type="password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
        <Button type="submit" loading={loading} className="py-3 sm:col-span-2">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already a member?{' '}
        <Link to="/login" className="font-semibold text-brand-600">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
