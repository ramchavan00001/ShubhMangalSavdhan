'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import { rupees } from '@/lib/labels';

interface Order {
  paymentId: string;
  mode: 'mock' | 'razorpay';
  orderId: string;
  keyId: string | null;
  amountPaise: number;
  basePaise: number;
  gstPaise: number;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window. Please check your connection.'));
    document.body.appendChild(s);
  });
}

export default function CheckoutPage() {
  const { me, ready, mutate } = useRequireMe();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready || !me) return <Loading />;

  async function done() {
    await mutate();
    router.replace('/payments?success=1');
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const o = order ?? (await api<Order>('/payments/order', { method: 'POST' }));
      setOrder(o);
      if (o.mode === 'mock') {
        setBusy(false);
        return;
      }
      await loadRazorpay();
      const rz = new window.Razorpay!({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amountPaise,
        currency: 'INR',
        name: 'Shubh Mangal Savdhan',
        description: 'Universal Premium — 1 month',
        prefill: { contact: `+${me!.phone}`, email: me!.email ?? undefined },
        theme: { color: '#5B0F1E' },
        handler: async (r: RazorpayResponse) => {
          try {
            await api('/payments/verify', {
              method: 'POST',
              json: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature },
            });
            await done();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on('payment.failed', () => {
        setError('Payment failed. No money was taken — please try again.');
        setBusy(false);
      });
      rz.open();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function completeMock() {
    setBusy(true);
    try {
      await api('/payments/mock/complete', { method: 'POST', json: { orderId: order!.orderId } });
      await done();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const base = order?.basePaise ?? 15000;
  const gst = order?.gstPaise ?? 2700;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-14">
      <h1 className="heading text-4xl">Universal Premium</h1>
      <div className="frame-double flex flex-col gap-4 bg-ivory-card p-7">
        <dl className="flex flex-col gap-2 text-[15px]">
          <div className="flex justify-between">
            <dt>Premium membership — 1 month</dt>
            <dd>{rupees(base)}</dd>
          </div>
          <div className="flex justify-between text-ink-muted">
            <dt>GST @ 18%</dt>
            <dd>{rupees(gst)}</dd>
          </div>
          <div className="flex justify-between border-t border-sand-line pt-3 text-lg font-bold">
            <dt>Total</dt>
            <dd>{rupees(base + gst)}</dd>
          </div>
        </dl>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
          <li>4 contact unlocks every week (16 this month), starting today</li>
          <li>Unlimited interests and see who viewed your profile</li>
          <li>Doesn’t auto-renew. We’ll remind you before it ends.</li>
        </ul>
        {error && <Alert tone="danger">{error}</Alert>}
        {order?.mode === 'mock' ? (
          <>
            <Alert tone="info">Test mode: no real payment is taken. Razorpay activates once its keys are configured.</Alert>
            <button type="button" className="btn-gold py-4 text-base" disabled={busy} onClick={completeMock}>
              {busy ? 'Completing…' : 'Complete test payment'}
            </button>
          </>
        ) : (
          <button type="button" className="btn-gold py-4 text-base" disabled={busy} onClick={pay}>
            {busy ? 'Opening payment…' : `Pay ${rupees(base + gst)}`}
          </button>
        )}
        <p className="text-center text-xs text-ink-muted">
          Secure payment by Razorpay: UPI, cards, net banking and wallets. See our <Link href="/refund-policy">refund policy</Link>.
        </p>
      </div>
    </div>
  );
}
