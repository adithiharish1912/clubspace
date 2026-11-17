import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CalendarDays, ChevronDown, ClipboardCheck, CreditCard, FileBarChart2, Gauge, IdCard, Layers,
  LogOut, Menu, Moon, Settings, ShieldCheck, Sun, User, Users, X, Wallet, ScanLine,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/client';
import { Avatar, Badge, cn } from '../ui';
import InstallApp from '../InstallApp';
import { label, timeAgo } from '../../utils/format';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge, roles: ['superadmin', 'admin', 'staff', 'member'] },
  { to: '/members', label: 'Members', icon: Users, roles: ['admin', 'staff'] },
  { to: '/plans', label: 'Membership Plans', icon: Layers, roles: ['admin'] },
  { to: '/payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'staff'] },
  { to: '/attendance', label: 'Attendance', icon: ScanLine, roles: ['admin', 'staff'] },
  { to: '/my/membership', label: 'My Membership', icon: IdCard, roles: ['member'] },
  { to: '/my/payments', label: 'My Payments', icon: Wallet, roles: ['member'] },
  { to: '/my/attendance', label: 'My Attendance', icon: ClipboardCheck, roles: ['member'] },
  { to: '/events', label: 'Events', icon: CalendarDays, roles: ['admin', 'staff', 'member'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'staff', 'member'] },
  { to: '/reports', label: 'Reports', icon: FileBarChart2, roles: ['admin'] },
  { to: '/users', label: 'Staff & Admins', icon: ShieldCheck, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['superadmin'] },
];

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-9 w-9" />
      <span className="text-lg font-extrabold tracking-tight text-white">
        Club<span className="text-brand-300">Space</span>
      </span>
    </Link>
  );
}

function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const items = NAV.filter((n) => user.role === 'superadmin' || n.roles.includes(user.role));
  return (
    <>
      <div className={cn('fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm transition lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={onClose} />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-gradient-to-b from-ink-800 via-ink-800 to-brand-950 transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">{label(user.role)} menu</p>
          {items.map(({ to, label: l, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-brand-600 text-white shadow-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {l}
            </NavLink>
          ))}
        </nav>
        <div className="px-3">
          <InstallApp />
        </div>
        <div className="m-3 rounded-2xl bg-white/5 p-4 text-xs text-slate-400">
          <p className="font-semibold text-slate-200">ClubSpace v1.0</p>
          <p className="mt-0.5">Club membership, simplified.</p>
        </div>
      </aside>
    </>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);
  const location = useLocation();

  const load = () =>
    api
      .get('/notifications', { params: { limit: 6 } })
      .then((r) => setData({ items: r.data.data, unread: r.data.meta.unread }))
      .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [location.pathname]);

  useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const readAll = async () => {
    await api.patch('/notifications/read-all');
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative p-2" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-scale-in overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
            <p className="text-sm font-bold">Notifications</p>
            {data.unread > 0 && (
              <button className="text-xs font-semibold text-brand-600" onClick={readAll}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up</li>}
            {data.items.map((n) => (
              <li key={n._id} className={cn('border-b border-slate-50 px-4 py-3 text-sm dark:border-white/5', !n.isRead && 'bg-brand-50/60 dark:bg-brand-500/5')}>
                <p className="font-semibold text-slate-900 dark:text-white">{n.title}</p>
                <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p>
                <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block py-2.5 text-center text-xs font-semibold text-brand-600 hover:bg-slate-50 dark:hover:bg-white/5">
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => setOpen((o) => !o)}>
        <Avatar src={user.avatar?.url} name={user.name} size="h-8 w-8" />
        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight">{user.name}</span>
          <span className="block text-[11px] text-slate-500">{label(user.role)}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>
      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-56 animate-scale-in p-1.5">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.email}</p>
            <Badge status={user.role} className="mt-1" />
          </div>
          <button className="btn-ghost w-full justify-start" onClick={() => { setOpen(false); navigate('/profile'); }}>
            <User className="h-4 w-4" /> My profile
          </button>
          <button className="btn-ghost w-full justify-start text-rose-600" onClick={async () => { await logout(); navigate('/login'); }}>
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { user, member } = useAuth();
  return (
    <div className="min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl dark:border-white/5 dark:bg-ink-900/80 sm:px-6">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {member && (
              <p className="hidden truncate text-sm text-slate-500 sm:block">
                Member ID <span className="font-bold text-slate-800 dark:text-slate-200">{member.membershipId}</span>
              </p>
            )}
          </div>
          <button className="btn-ghost p-2" onClick={toggle} aria-label="Toggle dark mode" title="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <NotificationBell />
          <UserMenu />
        </header>
        {user && !user.isEmailVerified && user.role === 'member' && <VerifyBanner />}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function VerifyBanner() {
  const [sent, setSent] = useState(false);
  const resend = async () => {
    const r = await api.post('/auth/resend-verification');
    setSent(true);
    if (r.data.devVerifyUrl) console.info('Dev verification link:', r.data.devVerifyUrl);
  };
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      Please verify your email address.{' '}
      {sent ? (
        <span className="font-semibold">Verification email sent.</span>
      ) : (
        <button className="font-semibold underline" onClick={resend}>
          Resend link
        </button>
      )}
    </div>
  );
}
