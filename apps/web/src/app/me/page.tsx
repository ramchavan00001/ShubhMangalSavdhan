'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import useSWR from 'swr';
import { PhotoManager } from '@/components/PhotoManager';
import { PreferencesForm } from '@/components/PreferencesForm';
import { PROFILE_STEPS, sectionBody, STEP_FIELDS, toValues, Values } from '@/components/ProfileFields';
import { Alert, Loading, PageTitle, Tabs } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import {
  CREATED_FOR,
  DIET,
  FAMILY_TYPE,
  FAMILY_VALUES,
  feetInches,
  formatDate,
  GENDER,
  HABIT,
  label,
  MANGLIK,
  MARITAL_STATUS,
} from '@/lib/labels';
import type { OwnProfile } from '@/lib/types';

type Tab = 'profile' | 'photos' | 'preferences';

const ENUM_LABELS: Record<string, Record<string, string>> = {
  createdFor: CREATED_FOR, gender: GENDER, maritalStatus: MARITAL_STATUS, manglik: MANGLIK, familyType: FAMILY_TYPE,
  familyValues: FAMILY_VALUES, diet: DIET, smoking: HABIT, drinking: HABIT,
};

/** Readable value for the collapsed section summary. */
function display(field: string, v: unknown): string {
  if (field === 'dateOfBirth' && typeof v === 'string') return formatDate(v);
  if (field === 'heightCm' && typeof v === 'number') return feetInches(v);
  if (field === 'smoking' || field === 'drinking') return `${field === 'smoking' ? 'Smoking' : 'Drinking'}: ${label(HABIT, String(v))}`;
  if (field === 'brothers' || field === 'sisters') return `${v} ${field}`;
  return ENUM_LABELS[field] ? label(ENUM_LABELS[field], String(v)) : String(v);
}

function EditSection({ index, profile, onSaved }: { index: number; profile: OwnProfile; onSaved: () => void }) {
  const { title, Fields } = PROFILE_STEPS[index];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(() => toValues(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = profile.status !== 'DRAFT' && profile.status !== 'REJECTED';

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/profiles/me', { method: 'PATCH', json: sectionBody(values, STEP_FIELDS[index], locked) });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="heading text-2xl">{title}</h2>
        {!open && (
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => {
              setValues(toValues(profile));
              setOpen(true);
            }}
          >
            Edit
          </button>
        )}
      </div>
      {open ? (
        <form onSubmit={save} className="mt-4 flex flex-col gap-5">
          <Fields values={values} set={(f, v) => setValues((x) => ({ ...x, [f]: v }))} locked={locked} />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          {STEP_FIELDS[index]
            .filter((f) => profile[f] !== null && profile[f] !== undefined && profile[f] !== '')
            .map((f) => display(f, profile[f]))
            .join(' · ')
            .slice(0, 260) || 'Not filled in yet.'}
        </p>
      )}
    </section>
  );
}

function MeInner() {
  const { me, ready, mutate: refreshMe } = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get('tab') as Tab) ?? 'profile';
  const { data: profile, mutate } = useSWR<OwnProfile>(ready ? '/profiles/me' : null, fetcher);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  if (!ready || !me || !profile) return <Loading />;

  const refresh = () => {
    mutate();
    refreshMe();
  };

  async function resubmit() {
    setResubmitError(null);
    try {
      await api('/profiles/me/submit', { method: 'POST' });
      refresh();
    } catch (e) {
      setResubmitError((e as Error).message);
    }
  }

  return (
    <div className="container-page flex max-w-4xl flex-col gap-8 py-12">
      <PageTitle eyebrow={profile.code} title="My profile">
        <Link href={`/profile/${profile.code}`} className="btn-outline">
          See how others see it
        </Link>
      </PageTitle>

      {params.get('submitted') === '1' && profile.status === 'PENDING' && (
        <Alert tone="success">Thank you! Your profile has been sent for review. We usually approve profiles within 24 hours.</Alert>
      )}
      {profile.status === 'PENDING' && params.get('submitted') !== '1' && <Alert tone="info">Your profile is under review.</Alert>}
      {profile.status === 'APPROVED' && <Alert tone="success">Your profile is live and visible to matching members.</Alert>}
      {profile.status === 'REJECTED' && (
        <Alert tone="warning">
          <strong>Our team asked for changes:</strong> {profile.rejectionReason ?? 'Please review your profile.'} Update the sections below,
          then{' '}
          <button type="button" className="font-bold text-maroon underline" onClick={resubmit}>
            resubmit for review
          </button>
          .
        </Alert>
      )}
      {resubmitError && <Alert tone="danger">{resubmitError}</Alert>}

      <div className="card flex flex-col gap-2 p-5">
        <div className="flex justify-between text-sm font-bold">
          <span>Profile completeness</span>
          <span>{profile.completeness}%</span>
        </div>
        <div className="h-2.5 w-full bg-sand-line" role="progressbar" aria-valuenow={profile.completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
          <div className="h-full bg-maroon" style={{ width: `${profile.completeness}%` }} />
        </div>
        {profile.completeness < 100 && <p className="text-sm text-ink-muted">Complete profiles with photos get many more interests.</p>}
      </div>

      <Tabs<Tab>
        tabs={[
          { value: 'profile', label: 'Details' },
          { value: 'photos', label: `Photos (${profile.photos.length})` },
          { value: 'preferences', label: 'Partner preferences' },
        ]}
        value={tab}
        onChange={(t) => router.replace(`/me?tab=${t}`)}
      />

      {tab === 'profile' && (
        <div className="flex flex-col gap-5">
          {PROFILE_STEPS.map((_, i) => (
            <EditSection key={i} index={i} profile={profile} onSaved={refresh} />
          ))}
        </div>
      )}
      {tab === 'photos' && (
        <div className="card p-6">
          <PhotoManager photos={profile.photos} onChange={refresh} />
        </div>
      )}
      {tab === 'preferences' && (
        <div className="card p-6">
          <PreferencesForm initial={profile.preference} />
        </div>
      )}
    </div>
  );
}

export default function MePage() {
  return (
    <Suspense fallback={<Loading />}>
      <MeInner />
    </Suspense>
  );
}
