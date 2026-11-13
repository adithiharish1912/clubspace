import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, Mail } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button, Input } from '../../components/ui';
import api, { errMsg } from '../../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ loading: false, done: false, error: '', devUrl: '' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, done: false, error: '' });
    try {
      const r = await api.post('/auth/forgot-password', { email });
      setState({ loading: false, done: true, error: '', devUrl: r.data.devResetUrl });
    } catch (err) {
      setState({ loading: false, done: false, error: errMsg(err) });
    }
  };

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your email and we'll send you a reset link.">
      {state.done ? (
        <div className="card p-6 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-brand-600" />
          <p className="mt-3 font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-slate-500">If {email} is registered, a reset link is on its way. It expires in 30 minutes.</p>
          {state.devUrl && (
            <a href={state.devUrl} className="mt-4 block break-all text-xs text-brand-600 underline">
              Development link (email not configured): {state.devUrl}
            </a>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {state.error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>}
          <Input label="Email" type="email" icon={Mail} required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={state.loading} className="w-full py-3">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-semibold text-brand-600">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
