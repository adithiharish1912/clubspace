import { createContext, useCallback, useContext, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, ShieldCheck, FlaskConical } from 'lucide-react';
import api, { errMsg } from '../api/client';
import { Button, Modal } from '../components/ui';
import { money } from '../utils/format';

const PaymentContext = createContext(null);

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/**
 * Provides pay({ subscriptionId } | { eventId }) → Promise<payment|null>.
 * Uses Razorpay Checkout when keys are configured on the server, otherwise
 * a clearly labelled demo checkout (development only).
 */
export function PaymentProvider({ children }) {
  const [demo, setDemo] = useState(null); // { order, resolve }
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);

  const pay = useCallback(async (target) => {
    let data;
    try {
      ({ data } = await api.post('/payments/order', target));
    } catch (err) {
      toast.error(errMsg(err));
      return null;
    }
    const order = data.data;

    if (order.demoMode) {
      return new Promise((resolve) => {
        resolver.current = resolve;
        setDemo(order);
      });
    }

    const ok = await loadRazorpay();
    if (!ok) {
      toast.error('Could not load Razorpay. Check your internet connection.');
      return null;
    }
    return new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.order.amount,
        currency: order.order.currency,
        name: order.clubName,
        description: order.description,
        order_id: order.order.id,
        prefill: order.prefill,
        theme: { color: '#2563eb' },
        handler: async (resp) => {
          try {
            const r = await api.post('/payments/verify', { paymentId: order.paymentId, ...resp });
            toast.success('Payment successful! Receipt sent to your email.');
            resolve(r.data.data);
          } catch (err) {
            toast.error(errMsg(err, 'Payment verification failed'));
            resolve(null);
          }
        },
        modal: {
          ondismiss: () => {
            api.post(`/payments/${order.paymentId}/failed`, { reason: 'Checkout closed' }).catch(() => {});
            resolve(null);
          },
        },
      });
      rzp.on('payment.failed', (resp) => {
        toast.error(resp.error?.description || 'Payment failed');
      });
      rzp.open();
    });
  }, []);

  const closeDemo = (result) => {
    if (!result && demo) api.post(`/payments/${demo.paymentId}/failed`, { reason: 'Demo checkout closed' }).catch(() => {});
    setDemo(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  const completeDemo = async () => {
    setBusy(true);
    try {
      const r = await api.post('/payments/demo/complete', { paymentId: demo.paymentId });
      toast.success('Payment successful!');
      closeDemo(r.data.data);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaymentContext.Provider value={{ pay }}>
      {children}
      <Modal
        open={Boolean(demo)}
        onClose={() => closeDemo(null)}
        title="Checkout"
        size="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => closeDemo(null)}>
              Cancel
            </Button>
            <Button onClick={completeDemo} loading={busy} icon={CreditCard}>
              Pay {demo && money(demo.order.amount / 100, demo.order.currency)}
            </Button>
          </>
        }
      >
        {demo && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <b>Demo mode.</b> Razorpay keys are not configured on the server, so no real money is charged. Add
                <code className="mx-1">RAZORPAY_KEY_ID</code>and<code className="mx-1">RAZORPAY_KEY_SECRET</code>to enable live checkout.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase text-slate-400">{demo.clubName}</p>
              <p className="mt-1 font-semibold">{demo.description}</p>
              <p className="mt-3 text-3xl font-extrabold text-brand-700 dark:text-brand-300">{money(demo.order.amount / 100, demo.order.currency)}</p>
              <p className="mt-1 text-xs text-slate-500">Order {demo.order.id}</p>
            </div>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Payments are verified on the server before your membership is activated.
            </p>
          </div>
        )}
      </Modal>
    </PaymentContext.Provider>
  );
}

export const usePayment = () => useContext(PaymentContext);
