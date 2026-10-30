'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import useSWR from 'swr';
import { Alert, Empty, Loading, PageTitle } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import { formatDate, rupees } from '@/lib/labels';

interface PaymentRow {
  id: string;
  status: 'PAID' | 'REFUNDED';
  totalPaise: number;
  invoiceNumber: string | null;
  paidAt: string | null;
  subscription: { startsAt: string; endsAt: string } | null;
}

function PaymentsInner() {
  const { me, ready } = useRequireMe();
  const success = useSearchParams().get('success') === '1';
  const { data } = useSWR<PaymentRow[]>(ready ? '/payments' : null, fetcher);
  if (!ready || !data) return <Loading />;

  return (
    <div className="container-page flex max-w-3xl flex-col gap-8 py-12">
      <PageTitle eyebrow="Billing" title="Payments & invoices" />
      {success && me?.plan.endsAt && (
        <Alert tone="success">Payment received. Universal Premium is active until {formatDate(me.plan.endsAt)}. Your 4 weekly unlocks start now.</Alert>
      )}
      {data.length === 0 ? (
        <Empty title="No payments yet" action={{ href: '/plans', label: 'See plans' }} />
      ) : (
        <ul className="flex flex-col gap-4">
          {data.map((p) => (
            <li key={p.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex flex-col gap-1">
                <p className="font-bold">
                  Universal Premium · {rupees(p.totalPaise)}{' '}
                  {p.status === 'REFUNDED' && <span className="badge bg-sand text-ink">Refunded</span>}
                </p>
                <p className="text-sm text-ink-muted">
                  {p.paidAt && `Paid ${formatDate(p.paidAt)}`}
                  {p.subscription && ` · Covers ${formatDate(p.subscription.startsAt)} – ${formatDate(p.subscription.endsAt)}`}
                </p>
              </div>
              {p.invoiceNumber && (
                <a href={`/api/payments/${p.id}/invoice`} target="_blank" rel="noopener" className="btn-outline text-sm">
                  Invoice {p.invoiceNumber}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PaymentsInner />
    </Suspense>
  );
}
