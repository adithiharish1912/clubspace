import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PartyPopper, Mail, IdCard } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button, Input, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { errMsg, fieldErrors } from '../../api/client';

function Success({ member, email }) {
  return (
    <AuthShell title="Congratulations! 🎉" subtitle="Your member account has been created successfully.">
      <div className="card animate-scale-in p-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
          <PartyPopper className="h-8 w-8" />
        </span>
        <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Welcome to the club, {member.firstName}!</p>
        <p className="mt-1 text-sm text-slate-500">You can now log in using your email and the password you just created.</p>

        <dl className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-left text-sm dark:bg-white/5">
          <div className="flex items-center gap-3">
            <IdCard className="h-5 w-5 text-brand-600" />
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Membership ID</dt>
              <dd className="font-mono font-bold">{member.membershipId}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-brand-600" />
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Login ID</dt>
              <dd className="break-all font-semibold">{email}</dd>
            </div>
          </div>
        </dl>

        <p className="mt-4 text-xs text-slate-500">A confirmation email has been sent to {email}. After logging in, choose a membership plan to activate your membership.</p>
        <Link to="/login" state={{ email }} className="btn-primary mt-6 w-full py-3">
          Log in now
        </Link>
      </div>
    </AuthShell>
  );
}

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
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
      setCreated({ member: res.data.member, email: res.data.user?.email || form.email });
      window.scrollTo(0, 0);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  if (created) return <Success member={created.member} email={created.email} />;

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
