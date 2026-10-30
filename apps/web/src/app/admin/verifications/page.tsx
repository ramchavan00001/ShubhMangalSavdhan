'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Alert, Empty, Loading, PageTitle, Tabs } from '@/components/ui';
import { api, fetcher, mediaUrl } from '@/lib/api';
import { formatDate } from '@/lib/labels';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
interface Row {
  id: string;
  type: 'ID' | 'SELFIE';
  status: Status;
  docType: string | null;
  docLast4: string | null;
  nameOnDoc: string | null;
  reason: string | null;
  createdAt: string;
  selfieUrl: string | null;
  profile: { id: string; userId: string; code: string; name: string; dateOfBirth: string | null; city: string | null; photos: string[] };
}

const REASONS = {
  ID: ['The name doesn’t match your profile.', 'We couldn’t confirm this document number. Please check and try again.'],
  SELFIE: ['The selfie doesn’t clearly match your profile photos.', 'The selfie is unclear. Please retake it in good light, facing the camera.'],
};

function Review({ v, onDone }: { v: Row; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const act = async (path: string, json?: unknown) => {
    setError(null);
    try {
      await api(`/admin/verifications/${v.id}/${path}`, { method: 'POST', json });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <article className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">
            {v.type === 'ID' ? 'ID check' : 'Selfie check'} · {v.profile.name} <span className="text-sm font-normal text-ink-muted">{v.profile.code}</span>
          </h2>
          <p className="text-sm text-ink-muted">
            Submitted {formatDate(v.createdAt, true)} · {v.profile.city} {v.profile.dateOfBirth && `· born ${formatDate(v.profile.dateOfBirth)}`}
          </p>
        </div>
        <Link href={`/admin/users/${v.profile.userId}`} className="text-sm">
          Member
        </Link>
      </div>
      {v.type === 'ID' ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-muted">Document</dt>
          <dd>
            {v.docType} ending {v.docLast4}
          </dd>
          <dt className="text-ink-muted">Name on document</dt>
          <dd className="font-semibold">{v.nameOnDoc}</dd>
          <dt className="text-ink-muted">Profile name</dt>
          <dd className="font-semibold">{v.profile.name}</dd>
          {v.reason && (
            <>
              <dt className="text-ink-muted">Note</dt>
              <dd>{v.reason}</dd>
            </>
          )}
        </dl>
      ) : (
        <div className="flex flex-wrap gap-4">
          <figure className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(v.selfieUrl)!} alt="Selfie" className="aspect-[4/5] w-40 border-2 border-gold object-cover" />
            <figcaption className="text-xs font-bold">Selfie</figcaption>
          </figure>
          {v.profile.photos.map((u, i) => (
            <figure key={u} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(u)!} alt={`Profile photo ${i + 1}`} className="aspect-[4/5] w-40 object-cover" />
              <figcaption className="text-xs text-ink-muted">Profile photo {i + 1}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {v.status === 'PENDING' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {REASONS[v.type].map((r) => (
              <button key={r} type="button" className="rounded-full border border-sand-input px-3 py-1.5 text-xs" onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Reason, if not approving" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => act('approve')}>
              Approve
            </button>
            <button type="button" className="btn-outline" disabled={!reason.trim()} onClick={() => act('reject', { reason })}>
              Not approved
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function AdminVerificationsPage() {
  const [status, setStatus] = useState<Status>('PENDING');
  const { data, mutate } = useSWR<Row[]>(`/admin/verifications?status=${status}`, fetcher);
  return (
    <>
      <PageTitle title="Verifications" />
      <Tabs<Status>
        tabs={[
          { value: 'PENDING', label: 'To review' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Not approved' },
        ]}
        value={status}
        onChange={setStatus}
      />
      {!data ? <Loading /> : data.length === 0 ? <Empty title="Nothing here" /> : data.map((v) => <Review key={v.id} v={v} onDone={() => mutate()} />)}
    </>
  );
}
