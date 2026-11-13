import { Check, Crown } from 'lucide-react';
import { cn } from './ui';
import { label, money } from '../utils/format';

export default function PlanCard({ plan, children, highlight }) {
  return (
    <div
      className={cn(
        'card relative flex animate-fade-up flex-col overflow-hidden p-6 transition hover:-translate-y-1 hover:shadow-xl',
        plan.isPremium && 'border-transparent bg-gradient-to-b from-ink-800 to-brand-950 text-white dark:from-brand-900 dark:to-ink-900',
        highlight && 'ring-2 ring-brand-500',
        !plan.isActive && 'opacity-60'
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: plan.color || '#2563eb' }} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn('text-sm font-bold', plan.isPremium ? 'text-brand-200' : 'text-brand-700 dark:text-brand-300')}>{plan.name}</p>
          <p className={cn('text-xs', plan.isPremium ? 'text-slate-400' : 'text-slate-500')}>
            {label(plan.durationType)} · {plan.durationDays} days
          </p>
        </div>
        {plan.isPremium && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-300">
            <Crown className="h-3.5 w-3.5" /> Premium
          </span>
        )}
        {!plan.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactive</span>}
      </div>
      <p className="mt-5 text-4xl font-extrabold tracking-tight">{money(plan.price)}</p>
      <p className={cn('text-xs', plan.isPremium ? 'text-slate-400' : 'text-slate-500')}>
        {plan.taxPercent ? `+ ${plan.taxPercent}% GST · ${money(plan.totalPrice)} total` : 'All inclusive'}
      </p>
      {plan.description && <p className={cn('mt-3 text-sm', plan.isPremium ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400')}>{plan.description}</p>}
      <ul className="mt-5 flex-1 space-y-2.5">
        {(plan.features || []).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={cn('mt-0.5 h-4 w-4 shrink-0', plan.isPremium ? 'text-brand-300' : 'text-emerald-600')} />
            {f}
          </li>
        ))}
      </ul>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
