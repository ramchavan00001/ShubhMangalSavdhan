'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Empty, Loading, PageTitle, Tabs } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { formatDate, label, REPORT_REASONS } from '@/lib/labels';

type Status = 'OPEN' | 'ACTIONED' | 'DISMISSED';
interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: Status;
  adminNote: string | null;
  createdAt: string;
  reporter: { code: string; name: string; userId: string };
  target: { code: string; name: string; userId: string; totalReports: number };
}

function ReportItem({ r, onDone }: { r: ReportRow; onDone: () => void }) {
  const [note, setNote] = useState(r.adminNote ?? '');
  const resolve = async (status: Status) => {
    await api(`/admin/reports/${r.id}`, { method: 'POST', json: { status, adminNote: note || undefined } });
    onDone();
  };
  return (
    <li className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-bold">{label(REPORT_REASONS, r.reason)}</p>
        <span className="text-xs text-ink-muted">{formatDate(r.createdAt, true)}</span>
      </div>
      <p className="text-sm">
        <Link href={`/admin/users/${r.target.userId}`}>
          {r.target.name} ({r.target.code})
        </Link>{' '}
        reported by{' '}
        <Link href={`/admin/users/${r.reporter.userId}`}>
          {r.reporter.name} ({r.reporter.code})
        </Link>
        {r.target.totalReports > 1 && <span className="badge ml-2 bg-danger-bg text-danger">{r.target.totalReports} reports in total</span>}
      </p>
      {r.details && <p className="bg-sand p-3 text-sm">{r.details}</p>}
      <label className="label">
        Internal note
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {r.status !== 'ACTIONED' && (
          <button type="button" className="btn-primary text-sm" onClick={() => resolve('ACTIONED')}>
            Mark actioned
          </button>
        )}
        {r.status !== 'DISMISSED' && (
          <button type="button" className="btn-outline text-sm" onClick={() => resolve('DISMISSED')}>
            Dismiss
          </button>
        )}
        {r.status !== 'OPEN' && (
          <button type="button" className="btn-ghost text-sm" onClick={() => resolve('OPEN')}>
            Reopen
          </button>
        )}
      </div>
    </li>
  );
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<Status>('OPEN');
  const { data, mutate } = useSWR<{ items: ReportRow[]; total: number }>(`/admin/reports?status=${status}`, fetcher);
  return (
    <>
      <PageTitle title="Reports" />
      <p className="text-sm text-ink-muted">Suspend or ban from the member’s page, then mark the report actioned.</p>
      <Tabs<Status>
        tabs={[
          { value: 'OPEN', label: 'Open' },
          { value: 'ACTIONED', label: 'Actioned' },
          { value: 'DISMISSED', label: 'Dismissed' },
        ]}
        value={status}
        onChange={setStatus}
      />
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="No reports here" />
      ) : (
        <ul className="flex flex-col gap-4">
          {data.items.map((r) => (
            <ReportItem key={r.id} r={r} onDone={() => mutate()} />
          ))}
        </ul>
      )}
    </>
  );
}
