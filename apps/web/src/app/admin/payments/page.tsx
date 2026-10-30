'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Alert, Loading, PageTitle, Pager } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { formatDate, rupees } from '@/lib/labels';

interface PaymentRow {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  totalPaise: number;
  invoiceNumber: string | null;
  createdAt: string;
  paidAt: string | null;
  member: { phone: string; name: string; code: string | null };
}

export default function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const { data, mutate } = useSWR<{ items: PaymentRow[]; total: number; pageSize: number }>(`/admin/payments?page=${page}`, fetcher);
  const [error, setError] = useState<string | null>(null);

  async function refund(id: string) {
    if (!confirm('Record this payment as refunded and end the Premium it bought? Issue the money back from the Razorpay dashboard.')) return;
    setError(null);
    try {
      await api(`/admin/payments/${id}/refund`, { method: 'POST' });
      mutate();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle title="Payments" />
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-sand">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Member</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-t border-sand-line">
                    <td className="p-3">{formatDate(p.paidAt ?? p.createdAt, true)}</td>
                    <td className="p-3">
                      {p.member.name}
                      <div className="text-xs text-ink-muted">
                        {p.member.code} · +{p.member.phone}
                      </div>
                    </td>
                    <td className="p-3">{rupees(p.totalPaise)}</td>
                    <td className="p-3">{p.status}</td>
                    <td className="p-3">
                      {p.invoiceNumber ? (
                        <a href={`/api/payments/${p.id}/invoice`} target="_blank" rel="noopener">
                          {p.invoiceNumber}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {p.provider} {p.providerPaymentId}
                    </td>
                    <td className="p-3">
                      {p.status === 'PAID' && (
                        <button type="button" className="text-sm text-danger underline" onClick={() => refund(p.id)}>
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} hasMore={page * data.pageSize < data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
