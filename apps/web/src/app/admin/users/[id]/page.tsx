'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import { Alert, Loading, PageTitle } from '@/components/ui';
import { api, fetcher, mediaUrl } from '@/lib/api';
import { formatDate, REPORT_REASONS, label, rupees } from '@/lib/labels';

interface AdminUser {
  id: string;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastActiveAt: string;
  profile:
    | ({
        id: string;
        code: string;
        status: string;
        rejectionReason: string | null;
        hidden: boolean;
        photos: { id: string; url: string; status: string }[];
        reportsReceived: { id: string; reason: string; details: string | null; status: string; createdAt: string }[];
        _count: { sentInterests: number; receivedInterests: number; unlocksMade: number };
      } & Record<string, unknown>)
    | null;
  subscriptions: { id: string; status: string; startsAt: string; endsAt: string; note: string | null }[];
  payments: { id: string; status: string; totalPaise: number; invoiceNumber: string | null; createdAt: string }[];
}

const SHOWN_FIELDS = [
  'firstName', 'lastName', 'gender', 'dateOfBirth', 'heightCm', 'maritalStatus', 'religion', 'community', 'motherTongue',
  'city', 'state', 'education', 'profession', 'annualIncome', 'familyType', 'diet', 'aboutMe',
];

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const { data, mutate } = useSWR<AdminUser>(`/admin/users/${id}`, fetcher);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');

  if (!data) return <Loading />;
  const p = data.profile;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'success', text: ok });
      mutate();
    } catch (e) {
      setMsg({ tone: 'danger', text: (e as Error).message });
    }
  }

  const setStatus = (status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => {
    if (status !== 'ACTIVE' && !confirm(`${status === 'BANNED' ? 'Ban' : 'Suspend'} this member? They will be logged out immediately.`)) return;
    run(() => api(`/admin/users/${id}/status`, { method: 'POST', json: { status } }), `Account is now ${status.toLowerCase()}.`);
  };

  function extend(e: FormEvent) {
    e.preventDefault();
    run(() => api(`/admin/users/${id}/extend-premium`, { method: 'POST', json: { days: Number(days), note } }), `Premium added for ${days} days.`);
  }

  return (
    <>
      <Link href="/admin/users" className="text-sm">
        ← Members
      </Link>
      <PageTitle eyebrow={p?.code} title={[p?.firstName, p?.lastName].filter(Boolean).join(' ') || `+${data.phone}`} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <section className="card flex flex-col gap-3 p-5">
        <p className="text-sm">
          +{data.phone} {data.email && `· ${data.email}`} · joined {formatDate(data.createdAt)} · last active {formatDate(data.lastActiveAt, true)}
        </p>
        <p className="text-sm">
          Account: <strong>{data.status}</strong> · Profile: <strong>{p?.status ?? '—'}</strong>
          {p?.hidden && ' · hidden'}
          {p && ` · ${p._count.sentInterests} interests sent, ${p._count.receivedInterests} received, ${p._count.unlocksMade} contacts unlocked`}
        </p>
        {data.role !== 'ADMIN' && (
          <div className="flex flex-wrap gap-2">
            {data.status !== 'ACTIVE' && (
              <button type="button" className="btn-primary" onClick={() => setStatus('ACTIVE')}>
                Reactivate
              </button>
            )}
            {data.status !== 'SUSPENDED' && (
              <button type="button" className="btn-outline" onClick={() => setStatus('SUSPENDED')}>
                Suspend
              </button>
            )}
            {data.status !== 'BANNED' && (
              <button type="button" className="btn bg-danger text-white hover:text-white" onClick={() => setStatus('BANNED')}>
                Ban
              </button>
            )}
          </div>
        )}
      </section>

      {p && (
        <section className="card p-5">
          <h2 className="heading mb-3 text-2xl">Profile</h2>
          {p.photos.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2">
              {p.photos.map((ph) => (
                <li key={ph.id} className="text-center text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(ph.url)!} alt="" className="aspect-[4/5] w-24 object-cover" />
                  {ph.status}
                </li>
              ))}
            </ul>
          )}
          <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {SHOWN_FIELDS.map((f) => (
              <div key={f} className={`flex gap-3 border-b border-sand-line py-2 text-sm ${f === 'aboutMe' ? 'sm:col-span-2' : ''}`}>
                <dt className="w-32 flex-none text-ink-muted">{f}</dt>
                <dd className="whitespace-pre-line">{p[f] == null ? '—' : String(p[f]).slice(0, f === 'dateOfBirth' ? 10 : undefined)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="heading text-2xl">Premium</h2>
        {data.subscriptions.length === 0 ? (
          <p className="text-sm text-ink-muted">Never subscribed.</p>
        ) : (
          <ul className="text-sm">
            {data.subscriptions.map((s) => (
              <li key={s.id} className="border-b border-sand-line py-2">
                {formatDate(s.startsAt)} – {formatDate(s.endsAt)} · {s.status} {s.note && `· ${s.note}`}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={extend} className="flex flex-wrap items-end gap-3">
          <label className="label">
            Add days
            <input className="input w-24" type="number" min={1} max={366} required value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <label className="label flex-1">
            Reason (internal)
            <input className="input" required maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Compensation for payment issue" />
          </label>
          <button type="submit" className="btn-outline">
            Give Premium
          </button>
        </form>
        {data.payments.length > 0 && (
          <ul className="text-sm">
            {data.payments.map((pay) => (
              <li key={pay.id} className="border-b border-sand-line py-2">
                {formatDate(pay.createdAt)} · {rupees(pay.totalPaise)} · {pay.status} {pay.invoiceNumber && `· ${pay.invoiceNumber}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      {p && p.reportsReceived.length > 0 && (
        <section className="card p-5">
          <h2 className="heading mb-3 text-2xl">Reports against this member</h2>
          <ul className="text-sm">
            {p.reportsReceived.map((r) => (
              <li key={r.id} className="border-b border-sand-line py-2">
                {formatDate(r.createdAt)} · <strong>{label(REPORT_REASONS, r.reason)}</strong> · {r.status} {r.details && `— ${r.details}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
