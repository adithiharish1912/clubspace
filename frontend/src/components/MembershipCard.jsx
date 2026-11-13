import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import api from '../api/client';
import { date, fullName } from '../utils/format';
import { Avatar, Badge, Modal } from './ui';

/** Digital membership card with QR code used at the check-in desk. */
export default function MembershipCard({ member, clubName = 'ClubSpace' }) {
  const [qr, setQr] = useState(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!member?._id) return;
    api.get(`/members/${member._id}/qr`).then((r) => setQr(r.data.data.dataUrl)).catch(() => {});
  }, [member?._id]);

  const plan = member.currentSubscription?.planSnapshot?.name;
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-800 to-ink-800 p-6 text-white shadow-glow">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-brand-400/20" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-200">{clubName}</p>
            <p className="mt-1 text-sm text-brand-100">{plan ? `${plan} member` : 'Membership'}</p>
          </div>
          <Badge status={member.status} className="!bg-white/15 !text-white !ring-white/30" />
        </div>
        <div className="relative mt-6 flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={member.photo?.url} name={fullName(member)} size="h-14 w-14" className="!ring-white/30" />
            <div className="min-w-0">
              <p className="line-clamp-2 break-words text-xl font-extrabold leading-tight">{fullName(member)}</p>
              <p className="font-mono text-sm tracking-wider text-brand-100">{member.membershipId}</p>
              <p className="mt-1 text-xs text-brand-200">Valid till {date(member.membershipExpiry)}</p>
            </div>
          </div>
          <button onClick={() => setZoom(true)} className="shrink-0 rounded-2xl bg-white p-2 shadow-lg transition hover:scale-105" aria-label="Show QR code">
            {qr ? <img src={qr} alt="Membership QR" className="h-20 w-20" /> : <QrCode className="h-20 w-20 text-slate-300" />}
          </button>
        </div>
      </div>
      <Modal open={zoom} onClose={() => setZoom(false)} title="Show this at the front desk" size="max-w-sm">
        <div className="text-center">
          {qr && <img src={qr} alt="Membership QR" className="mx-auto w-64 rounded-xl bg-white p-3" />}
          <p className="mt-3 font-mono font-bold">{member.membershipId}</p>
          <p className="text-sm text-slate-500">{fullName(member)}</p>
        </div>
      </Modal>
    </>
  );
}
