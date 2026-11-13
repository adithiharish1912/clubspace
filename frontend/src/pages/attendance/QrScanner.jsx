import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

/** Camera QR scanner. Calls onScan(text); ignores repeats of the same code within 4 seconds. */
export default function QrScanner({ onScan }) {
  const last = useRef({ text: '', at: 0 });
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 220, height: 220 }, rememberLastUsedCamera: true }, false);
    scanner.render(
      (text) => {
        const now = Date.now();
        if (text === last.current.text && now - last.current.at < 4000) return;
        last.current = { text, at: now };
        cb.current(text);
      },
      () => {}
    );
    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return <div id="qr-reader" className="overflow-hidden rounded-2xl" />;
}
