import { useState } from 'react';
import { BadgePercent, CheckCircle2, X } from 'lucide-react';
import api, { errMsg } from '../api/client';
import { Button, cn } from './ui';

/**
 * "Have a coupon?" field. Checks the code with the server and reports the result
 * through onApply({ code, label, description, prices:[{planId,total,discount,payable}] }) or onApply(null).
 */
export default function CouponBox({ applied, onApply, memberId, planId, compact = false, className }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/coupons/validate', { code: code.trim(), ...(memberId ? { memberId } : {}), ...(planId ? { planId } : {}) });
      onApply(r.data.data);
    } catch (err) {
      setError(errMsg(err));
      onApply(null);
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    return (
      <div className={cn('flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10', className)}>
        <span className="flex min-w-0 items-center gap-2 text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="min-w-0">
            <b className="font-mono">{applied.code}</b> applied — {applied.label}
            {applied.description && !compact && <span className="block text-xs opacity-80">{applied.description}</span>}
          </span>
        </span>
        <button
          type="button"
          className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-white/10"
          onClick={() => {
            onApply(null);
            setCode('');
          }}
          aria-label="Remove coupon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <BadgePercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 font-mono uppercase placeholder:font-sans placeholder:normal-case"
            placeholder="Have a coupon code?"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && apply(e)}
            aria-label="Coupon code"
          />
        </div>
        <Button type="button" variant="secondary" onClick={apply} loading={busy} disabled={!code.trim()}>
          Apply
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
