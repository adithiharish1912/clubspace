import { forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Inbox, Loader2, X, AlertTriangle } from 'lucide-react';
import { assetUrl } from '../api/client';
import { initials, label } from '../utils/format';

export const cn = clsx;

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cn('animate-spin text-brand-600', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function Button({ variant = 'primary', loading, children, className, icon: Icon, ...props }) {
  return (
    <button className={cn(`btn-${variant}`, className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export const Input = forwardRef(function Input({ label: l, error, hint, className, icon: Icon, ...props }, ref) {
  return (
    <label className={cn('block', className)}>
      {l && <span className="label">{l}</span>}
      <span className="relative block">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        <input ref={ref} className={cn('input', Icon && 'pl-9', error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15')} {...props} />
      </span>
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
});

export function Select({ label: l, error, options = [], className, placeholder, ...props }) {
  return (
    <label className={cn('block', className)}>
      {l && <span className="label">{l}</span>}
      <select className={cn('input pr-8', error && 'border-rose-400')} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          return (
            <option key={v} value={v}>
              {typeof o === 'object' ? o.label : label(o)}
            </option>
          );
        })}
      </select>
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Textarea({ label: l, error, className, ...props }) {
  return (
    <label className={cn('block', className)}>
      {l && <span className="label">{l}</span>}
      <textarea className={cn('input min-h-[96px]', error && 'border-rose-400')} {...props} />
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label: l, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{l}</span>
        {description && <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/15')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Card({ className, children, title, action, padded = true }) {
  return (
    <section className={cn('card animate-fade-up', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          {action}
        </header>
      )}
      <div className={cn(padded && 'p-5')}>{children}</div>
    </section>
  );
}

const BADGE = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  registered: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  attended: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300',
  upcoming: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300',
  ongoing: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  pending_payment: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  created: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  partially_refunded: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300',
  expired: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-white/5 dark:text-slate-400',
  completed: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-white/5 dark:text-slate-400',
  refunded: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-white/5 dark:text-slate-400',
  failed: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300',
  suspended: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300',
  superadmin: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300',
  admin: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300',
  staff: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-500/10 dark:text-cyan-300',
};

export function Badge({ status, children, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', BADGE[status] || BADGE.expired, className)}>
      {children || label(status)}
    </span>
  );
}

export function Avatar({ src, name, size = 'h-9 w-9', className }) {
  const url = assetUrl(src);
  return url ? (
    <img src={url} alt={name} className={cn(size, 'shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-ink-800', className)} />
  ) : (
    <span className={cn(size, 'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white', className)}>
      {initials(name)}
    </span>
  );
}

export function StatCard({ label: l, value, icon: Icon, tone = 'brand', hint, onClick }) {
  const tones = {
    brand: 'from-brand-500 to-brand-700',
    green: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-400 to-orange-600',
    rose: 'from-rose-500 to-rose-700',
    violet: 'from-violet-500 to-violet-700',
    slate: 'from-slate-500 to-slate-700',
    cyan: 'from-cyan-500 to-sky-700',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="card group flex animate-fade-up items-center gap-4 p-4 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg sm:p-5"
    >
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg', tones[tone])}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{l}</span>
        <span className="block truncate text-2xl font-extrabold text-slate-900 dark:text-white">{value}</span>
        {hint && <span className="block truncate text-xs text-slate-400">{hint}</span>}
      </span>
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
        <Icon className="h-7 w-7" />
      </span>
      <p className="font-bold text-slate-900 dark:text-white">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> {message}
      </span>
      {onRetry && (
        <button className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) {
    return meta ? <p className="px-5 py-3 text-xs text-slate-500">{meta.total} record(s)</p> : null;
  }
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <span className="text-xs text-slate-500">
        Page {meta.page} of {meta.pages} · {meta.total} record(s)
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary px-2.5 py-1.5" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="btn-secondary px-2.5 py-1.5" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cn('card flex max-h-[92vh] w-full animate-scale-in flex-col rounded-b-none sm:rounded-2xl', size)}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/5">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmText = 'Confirm', danger, loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </Modal>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-white/5">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
            value === t.value ? 'bg-white text-brand-700 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs opacity-60">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-slate-800 dark:text-slate-200">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
