import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { Modal, cn } from './ui';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * "Install app" button. Android / desktop Chrome: shows the browser's install prompt.
 * iPhone / iPad: explains "Share → Add to Home Screen" (Safari has no install prompt).
 * Hidden when ClubSpace is already running as an installed app.
 */
export default function InstallApp({ className, variant = 'sidebar' }) {
  const [canPrompt, setCanPrompt] = useState(Boolean(window.__installPrompt));
  const [iosHelp, setIosHelp] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());

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

  if (installed || (!canPrompt && !isIOS())) return null;

  const install = async () => {
    if (isIOS()) return setIosHelp(true);
    const prompt = window.__installPrompt;
    if (!prompt) return null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__installPrompt = null;
    setCanPrompt(false);
    if (outcome === 'accepted') setInstalled(true);
    return null;
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={cn(
          variant === 'sidebar'
            ? 'flex w-full items-center gap-3 rounded-xl bg-brand-600/20 px-3 py-2.5 text-sm font-semibold text-brand-200 transition hover:bg-brand-600/30'
            : 'btn-secondary w-full',
          className
        )}
      >
        <Download className="h-[18px] w-[18px]" /> Install ClubSpace app
      </button>
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="Install on iPhone / iPad" size="max-w-sm">
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
    </>
  );
}
