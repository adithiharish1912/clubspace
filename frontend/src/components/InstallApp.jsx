import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Download, Share, SquarePlus, Smartphone, X, MoreVertical } from 'lucide-react';
import { Modal, cn } from './ui';
import { useAuth } from '../context/AuthContext';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const InstallContext = createContext(null);

/**
 * Shares install state across the banner and the buttons.
 * Android / desktop Chrome: uses the browser's install prompt.
 * iPhone / iPad (or any browser without a prompt): shows step-by-step instructions.
 */
export function InstallProvider({ children }) {
  const [canPrompt, setCanPrompt] = useState(Boolean(window.__installPrompt));
  const [installed, setInstalled] = useState(isStandalone());
  const [help, setHelp] = useState(null); // 'ios' | 'android'

  useEffect(() => {
    const ready = () => setCanPrompt(true);
    const done = () => setInstalled(true);
    window.addEventListener('cs-installable', ready);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('cs-installable', ready);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  const install = useCallback(async (platform) => {
    const wantsIOS = platform === 'ios' || (!platform && isIOS());
    if (wantsIOS) return setHelp('ios');
    const prompt = window.__installPrompt;
    if (!prompt) return setHelp('android');
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__installPrompt = null;
    setCanPrompt(false);
    if (outcome === 'accepted') setInstalled(true);
    return null;
  }, []);

  return (
    <InstallContext.Provider value={{ installed, canPrompt, install }}>
      {children}
      <Modal open={help === 'ios'} onClose={() => setHelp(null)} title="Install on iPhone / iPad" size="max-w-sm">
        <ol className="space-y-4 text-sm">
          <li className="flex items-start gap-3">
            <Share className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span>
              Open this page in <b>Safari</b> and tap the <b>Share</b> button at the bottom of the screen.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <SquarePlus className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span>
              Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-5 w-5 shrink-0 rounded" />
            <span>ClubSpace now opens from your home screen like an app.</span>
          </li>
        </ol>
      </Modal>
      <Modal open={help === 'android'} onClose={() => setHelp(null)} title="Install on Android" size="max-w-sm">
        <ol className="space-y-4 text-sm">
          <li className="flex items-start gap-3">
            <MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span>
              Open this page in <b>Chrome</b> and tap the <b>⋮ menu</b> at the top right.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span>
              Tap <b>Install app</b> (or <b>Add to Home screen</b>), then <b>Install</b>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-5 w-5 shrink-0 rounded" />
            <span>ClubSpace now opens from your home screen like an app.</span>
          </li>
        </ol>
      </Modal>
    </InstallContext.Provider>
  );
}

export const useInstall = () => useContext(InstallContext);

/** Small "Install ClubSpace app" button (sidebar and login page). */
export default function InstallApp({ className, variant = 'sidebar' }) {
  const ctx = useInstall();
  if (!ctx || ctx.installed || (!ctx.canPrompt && !isIOS())) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.install()}
      className={cn(
        variant === 'sidebar'
          ? 'flex w-full items-center gap-3 rounded-xl bg-brand-600/20 px-3 py-2.5 text-sm font-semibold text-brand-200 transition hover:bg-brand-600/30'
          : 'btn-secondary w-full',
        className
      )}
    >
      <Download className="h-[18px] w-[18px]" /> Install ClubSpace app
    </button>
  );
}

const DISMISS_KEY = 'cs-app-banner-dismissed';

/** Red, gently blinking "Get the app" banner shown when the page opens. */
export function InstallBanner() {
  const ctx = useInstall();
  const auth = useAuth();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!ctx || ctx.installed || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <>
    {/* spacer so the banner never covers the bottom of the page */}
    <div aria-hidden className="h-44 sm:h-24" />
    <div className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4', auth?.user && 'lg:pl-[19rem]')} style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="cs-blink pointer-events-auto relative mx-auto flex max-w-4xl flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-4 text-white shadow-lg sm:flex-row sm:items-center sm:gap-4 sm:p-3 sm:pl-4">
        <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Smartphone className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-300 opacity-90" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-300" />
            </span>
          </span>
          <div className="min-w-0 pr-6 sm:pr-0">
            <p className="text-sm font-extrabold uppercase tracking-wide sm:text-base">Get the ClubSpace app</p>
            <p className="text-xs text-red-100 sm:text-sm">Click here to download the app — faster access, one tap from your home screen.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button
            type="button"
            onClick={() => ctx.install('android')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-red-700 shadow transition hover:bg-red-50 active:scale-[.98]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M17.6 9.48l1.84-3.18a.38.38 0 00-.65-.38l-1.86 3.22a11.4 11.4 0 00-9.86 0L5.21 5.92a.38.38 0 00-.65.38L6.4 9.48A10.78 10.78 0 001 18h22a10.78 10.78 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 111.25-1.25A1.25 1.25 0 017 15.25zm10 0A1.25 1.25 0 1118.25 14 1.25 1.25 0 0117 15.25z" />
            </svg>
            Android
          </button>
          <button
            type="button"
            onClick={() => ctx.install('ios')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-black/30 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/40 transition hover:bg-black/40 active:scale-[.98]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31a4.05 4.05 0 00-3.18-1.72c-1.35-.14-2.65.8-3.33.8-.7 0-1.75-.78-2.88-.76A4.25 4.25 0 005.28 9.8c-1.54 2.67-.39 6.6 1.1 8.77.74 1.06 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.14a9.4 9.4 0 001.2-2.47 3.84 3.84 0 01-2.29-3.54zM14.2 6.13a3.86 3.86 0 00.89-2.78 3.96 3.96 0 00-2.56 1.33 3.7 3.7 0 00-.92 2.68 3.27 3.27 0 002.59-1.23z" />
            </svg>
            iPhone
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-2 top-2 rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white sm:static sm:shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
    </>
  );
}
