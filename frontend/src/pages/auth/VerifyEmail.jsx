import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, XCircle } from 'lucide-react';
import AuthShell from './AuthShell';
import { Spinner } from '../../components/ui';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function VerifyEmail() {
  const { token } = useParams();
  const { user, refresh } = useAuth();
  const [state, setState] = useState({ loading: true, ok: false, message: '' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api
      .get(`/auth/verify-email/${token}`)
      .then((r) => {
        setState({ loading: false, ok: true, message: r.data.message });
        refresh();
      })
      .catch((err) => setState({ loading: false, ok: false, message: errMsg(err) }));
  }, [token, refresh]);

  return (
    <AuthShell title="Email verification">
      <div className="card p-8 text-center">
        {state.loading ? (
          <Spinner className="mx-auto h-8 w-8" />
        ) : state.ok ? (
          <BadgeCheck className="mx-auto h-12 w-12 text-emerald-600" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-rose-600" />
        )}
        <p className="mt-4 font-semibold">{state.loading ? 'Verifying…' : state.message}</p>
        {!state.loading && (
          <Link to={user ? '/dashboard' : '/login'} className="btn-primary mt-6">
            {user ? 'Go to dashboard' : 'Log in'}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
