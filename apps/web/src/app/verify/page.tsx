'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import useSWR from 'swr';
import { Camera, ShieldCheck } from '@/components/icons';
import { Alert, Loading, PageTitle } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';

interface Step {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  docType: string | null;
  docLast4: string | null;
  reason: string | null;
}
interface Status {
  verified: boolean;
  idVerified: boolean;
  selfieVerified: boolean;
  id: Step | null;
  selfie: Step | null;
  docTypes: { value: string; label: string; example: string }[];
  testMode: boolean;
}

function StepState({ done, step }: { done: boolean; step: Step | null }) {
  if (done) return <span className="badge bg-success-bg text-success">Verified</span>;
  if (step?.status === 'PENDING') return <span className="badge bg-sand text-ink">In review</span>;
  if (step?.status === 'REJECTED') return <span className="badge bg-danger-bg text-danger">Not approved</span>;
  return <span className="badge bg-sand text-ink-muted">Not started</span>;
}

export default function VerifyPage() {
  const { ready } = useRequireMe();
  const { data, mutate } = useSWR<Status>(ready ? '/verification' : null, fetcher);
  const [docType, setDocType] = useState('PAN');
  const [number, setNumber] = useState('');
  const [nameOnDoc, setNameOnDoc] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready || !data) return <Loading />;

  async function run(fn: () => Promise<Step>, okText: (s: Step) => string) {
    setBusy(true);
    setMsg(null);
    try {
      const s = await fn();
      setMsg({ tone: s.status === 'APPROVED' ? 'success' : 'info', text: okText(s) });
      await mutate();
    } catch (e) {
      setMsg({ tone: 'danger', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function submitId(e: FormEvent) {
    e.preventDefault();
    run(
      () => api<Step>('/verification/id', { method: 'POST', json: { docType, number, nameOnDoc } }),
      (s) => (s.status === 'APPROVED' ? 'Your ID is verified.' : 'Thank you. Our team will check your ID, usually within 24 hours.'),
    );
    setNumber('');
  }

  function uploadSelfie(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const body = new FormData();
    body.append('file', f);
    run(() => api<Step>('/verification/selfie', { method: 'POST', body }), () => 'Thank you. Our team will compare your selfie with your photos, usually within 24 hours.');
  }

  const example = data.docTypes.find((d) => d.value === docType)?.example;

  return (
    <div className="container-page flex max-w-3xl flex-col gap-8 py-12">
      <PageTitle eyebrow="Trust" title="Get verified" />
      {data.verified ? (
        <Alert tone="success">You’re verified. Your profile shows the ✓ Verified badge, and verified profiles get noticed much more.</Alert>
      ) : (
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Two quick steps earn the <strong>✓ Verified</strong> badge: confirm your ID, and take a selfie so we can check your photos are really you. Families
          trust verified profiles more, and many members search for verified profiles only.
        </p>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <section className="card flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="heading flex items-center gap-2 text-2xl">
            <ShieldCheck className="text-gold-dark" /> 1. Government ID
          </h2>
          <StepState done={data.idVerified} step={data.id} />
        </div>
        {data.id?.status === 'REJECTED' && data.id.reason && <Alert tone="warning">{data.id.reason}</Alert>}
        {!data.idVerified && data.id?.status !== 'PENDING' && (
          <form onSubmit={submitId} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="label">
                Document
                <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {data.docTypes.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                Document number
                <input className="input uppercase" required value={number} onChange={(e) => setNumber(e.target.value)} placeholder={example} autoComplete="off" />
              </label>
              <label className="label sm:col-span-2">
                Full name exactly as on the document
                <input className="input" required value={nameOnDoc} onChange={(e) => setNameOnDoc(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-ink-muted">
              We check the number and keep only its last 4 characters — never the full number or a copy of the document. Aadhaar verification through
              DigiLocker is coming soon.
            </p>
            <div>
              <button type="submit" className="btn-primary" disabled={busy}>
                Verify ID
              </button>
            </div>
          </form>
        )}
        {data.id?.status === 'PENDING' && <p className="text-sm text-ink-muted">Our team is reviewing your {data.id.docType?.replace('_', ' ').toLowerCase()} (ending {data.id.docLast4}).</p>}
      </section>

      <section className="card flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="heading flex items-center gap-2 text-2xl">
            <Camera className="text-gold-dark" /> 2. Selfie
          </h2>
          <StepState done={data.selfieVerified} step={data.selfie} />
        </div>
        {data.selfie?.status === 'REJECTED' && data.selfie.reason && <Alert tone="warning">{data.selfie.reason}</Alert>}
        {!data.selfieVerified && data.selfie?.status !== 'PENDING' && (
          <>
            <p className="text-[15px] text-ink-soft">
              Take a clear selfie in good light, facing the camera, without sunglasses. Only our verification team sees it — it’s never shown on your profile.
            </p>
            <div>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Camera size={20} /> Take selfie
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden onChange={uploadSelfie} />
            <p className="text-xs text-ink-muted">
              Need a profile photo first? <Link href="/me?tab=photos">Add photos</Link>
            </p>
          </>
        )}
        {data.selfie?.status === 'PENDING' && <p className="text-sm text-ink-muted">Our team is comparing your selfie with your photos.</p>}
      </section>
      {data.testMode && <p className="text-xs text-ink-muted">Test mode: IDs are approved automatically when the name matches your profile.</p>}
    </div>
  );
}
