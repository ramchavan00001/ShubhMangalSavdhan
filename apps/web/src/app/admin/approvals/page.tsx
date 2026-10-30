'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Alert, Empty, Loading, PageTitle } from '@/components/ui';
import { api, fetcher, mediaUrl } from '@/lib/api';
import { CREATED_FOR, DIET, feetInches, formatDate, label, MARITAL_STATUS } from '@/lib/labels';

interface PendingProfile {
  id: string;
  userId: string;
  code: string;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  age: number | null;
  heightCm: number | null;
  createdFor: string;
  maritalStatus: string | null;
  religion: string | null;
  community: string | null;
  motherTongue: string | null;
  city: string | null;
  state: string | null;
  education: string | null;
  profession: string | null;
  annualIncome: string | null;
  diet: string | null;
  aboutMe: string | null;
  updatedAt: string;
  user: { phone: string; createdAt: string };
  photos: { id: string; url: string; status: string; isMain: boolean }[];
}

interface Approvals {
  profiles: PendingProfile[];
  photos: { id: string; url: string; profile: { id: string; code: string; name: string } }[];
}

const QUICK_REASONS = [
  'Please add a clear photo of your face.',
  'Your description contains contact details. Please remove them.',
  'Some details look incomplete or incorrect. Please review them.',
  'Photos must show only you — no group, celebrity or stock photos.',
];

function ProfileReview({ p, onDone }: { p: PendingProfile; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <article className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {p.firstName} {p.lastName} <span className="text-sm font-normal text-ink-muted">· {p.code}</span>
          </h2>
          <p className="text-sm text-ink-muted">
            {label({ MALE: 'Male', FEMALE: 'Female' }, p.gender)} · {p.age} yrs · {feetInches(p.heightCm)} · {label(MARITAL_STATUS, p.maritalStatus)} · created by{' '}
            {label(CREATED_FOR, p.createdFor)}
          </p>
          <p className="text-sm text-ink-muted">
            +{p.user.phone} · joined {formatDate(p.user.createdAt)} · submitted {formatDate(p.updatedAt, true)}
          </p>
        </div>
        <Link href={`/admin/users/${p.userId}`} className="text-sm">
          Full details
        </Link>
      </div>
      <p className="text-sm">
        {[p.religion, p.community, p.motherTongue, [p.city, p.state].filter(Boolean).join(', '), p.education, p.profession, p.annualIncome, label(DIET, p.diet)]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="whitespace-pre-line bg-sand p-3 text-sm leading-relaxed">{p.aboutMe}</p>
      {p.photos.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {p.photos.map((ph) => (
            <li key={ph.id} className="flex w-28 flex-col gap-1">
              <a href={mediaUrl(ph.url)!} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(ph.url)!} alt={`Photo of ${p.firstName}`} className="aspect-[4/5] w-28 object-cover" />
              </a>
              {ph.status === 'REJECTED' ? (
                <span className="text-xs text-danger">Rejected</span>
              ) : (
                <button type="button" className="text-xs text-danger underline" onClick={() => run(() => api(`/admin/photos/${ph.id}/reject`, { method: 'POST' }))}>
                  Reject photo
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No photos uploaded.</p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {rejecting ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/admin/profiles/${p.id}/reject`, { method: 'POST', json: { reason } }));
          }}
        >
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((r) => (
              <button key={r} type="button" className="rounded-full border border-sand-input px-3 py-1.5 text-xs" onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <label className="label">
            Message to the member
            <textarea className="input min-h-[80px]" required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn bg-danger text-white hover:text-white" disabled={busy || !reason.trim()}>
              Send back for changes
            </button>
            <button type="button" className="btn-ghost" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => run(() => api(`/admin/profiles/${p.id}/approve`, { method: 'POST' }))}>
            Approve
          </button>
          <button type="button" className="btn-outline" disabled={busy} onClick={() => setRejecting(true)}>
            Ask for changes
          </button>
        </div>
      )}
    </article>
  );
}

export default function ApprovalsPage() {
  const { data, mutate } = useSWR<Approvals>('/admin/approvals', fetcher);
  if (!data) return <Loading />;

  const photoDecision = async (id: string, d: 'approve' | 'reject') => {
    await api(`/admin/photos/${id}/${d}`, { method: 'POST' });
    mutate();
  };

  return (
    <>
      <PageTitle title="Approvals" />
      <h2 className="heading text-2xl">New profiles ({data.profiles.length})</h2>
      {data.profiles.length === 0 ? <Empty title="All caught up" body="No profiles waiting for review." /> : data.profiles.map((p) => <ProfileReview key={p.id} p={p} onDone={() => mutate()} />)}

      <h2 className="heading mt-4 text-2xl">New photos on live profiles ({data.photos.length})</h2>
      {data.photos.length === 0 ? (
        <p className="text-sm text-ink-muted">No photos waiting.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {data.photos.map((ph) => (
            <li key={ph.id} className="card flex flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(ph.url)!} alt={`Photo of ${ph.profile.name}`} className="aspect-[4/5] w-full object-cover" />
              <p className="px-3 pt-2 text-sm font-semibold">
                {ph.profile.name} <span className="font-normal text-ink-muted">{ph.profile.code}</span>
              </p>
              <div className="flex">
                <button type="button" className="btn-ghost flex-1 text-sm text-success" onClick={() => photoDecision(ph.id, 'approve')}>
                  Approve
                </button>
                <button type="button" className="btn-ghost flex-1 text-sm text-danger" onClick={() => photoDecision(ph.id, 'reject')}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
