import { CalendarCheck2, CreditCard, QrCode, ShieldCheck } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import InstallApp from '../../components/InstallApp';

const FEATURES = [
  { icon: CreditCard, text: 'Secure online payments with instant receipts' },
  { icon: QrCode, text: 'QR-code check-in at the front desk' },
  { icon: CalendarCheck2, text: 'Events, renewals and reminders in one place' },
  { icon: ShieldCheck, text: 'Role-based access for admins, staff & members' },
];

export default function AuthShell({ title, subtitle, children }) {
  const { data: club } = useFetch('/settings/public');
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-11 w-11" />
          <span className="text-2xl font-extrabold tracking-tight">
            Club<span className="text-brand-300">Space</span>
          </span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight">
            {club?.clubName && club.clubName !== 'ClubSpace Club' ? club.clubName : 'Run your club like a pro.'}
          </h2>
          <p className="mt-3 text-lg text-slate-300">{club?.tagline || 'Memberships, payments, attendance and events — beautifully organised.'}</p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-slate-200">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-5 w-5 text-brand-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">© {new Date().getFullYear()} ClubSpace</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="" className="h-10 w-10" />
            <span className="text-xl font-extrabold">
              Club<span className="text-brand-600">Space</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          <InstallApp variant="button" className="mt-6" />
        </div>
      </div>
    </div>
  );
}
