'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import useSWR from 'swr';
import { PhotoManager } from '@/components/PhotoManager';
import { PreferencesForm } from '@/components/PreferencesForm';
import { PROFILE_STEPS, sectionBody, STEP_FIELDS, toValues, Values } from '@/components/ProfileFields';
import { Alert, Loading } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import type { OwnProfile } from '@/lib/types';

const TITLES = [...PROFILE_STEPS.map((s) => s.title), 'Photos', 'Partner preferences'];
const TOTAL = TITLES.length;

export default function OnboardingPage() {
  const router = useRouter();
  const { me, ready, mutate: refreshMe } = useRequireMe({ needsProfile: false });
  const { data: profile, mutate } = useSWR<OwnProfile>(ready ? '/profiles/me' : null, fetcher);
  const [step, setStep] = useState<number | null>(null);
  const [values, setValues] = useState<Values>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once submitted, the wizard is done — edits happen on /me.
  useEffect(() => {
    if (me && me.profile && me.profile.status !== 'DRAFT' && me.profile.status !== 'REJECTED') router.replace('/me');
    if (me?.role === 'ADMIN') router.replace('/admin');
  }, [me, router]);

  useEffect(() => {
    if (profile && step === null) {
      setValues(toValues(profile));
      setStep(Math.min(profile.onboardingStep, TOTAL));
    }
  }, [profile, step]);

  if (!ready || !profile || step === null) return <Loading />;

  const set = (field: string, value: string | number | null) => setValues((v) => ({ ...v, [field]: value }));
  const go = (n: number) => {
    setError(null);
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  async function saveSection(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api<OwnProfile>(`/profiles/me/step/${step}`, {
        method: 'PATCH',
        json: sectionBody(values, STEP_FIELDS[step! - 1]),
      });
      await mutate(updated, { revalidate: false });
      go(step! + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('/profiles/me/submit', { method: 'POST' });
      await refreshMe();
      router.replace('/me?submitted=1');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const section = step <= PROFILE_STEPS.length ? PROFILE_STEPS[step - 1] : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-3">
        <p className="eyebrow">
          Step {step} of {TOTAL}
        </p>
        <h1 className="heading text-4xl sm:text-5xl">{TITLES[step - 1]}</h1>
        <div className="flex gap-1.5" aria-hidden="true">
          {TITLES.map((t, i) => (
            <span key={t} className={`h-1.5 flex-1 ${i < step ? 'bg-maroon' : 'bg-sand-line'}`} />
          ))}
        </div>
        {profile.status === 'REJECTED' && profile.rejectionReason && (
          <Alert tone="warning">
            <strong>Our team asked for changes:</strong> {profile.rejectionReason}
          </Alert>
        )}
      </div>

      <div className="frame-double bg-ivory-card p-6 sm:p-9">
        {section ? (
          <form onSubmit={saveSection} className="flex flex-col gap-6">
            <section.Fields values={values} set={set} />
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-between gap-3">
              <button type="button" className="btn-ghost" disabled={step === 1} onClick={() => go(step - 1)}>
                Back
              </button>
              <button type="submit" className="btn-primary px-8" disabled={busy}>
                {busy ? 'Saving…' : 'Save and continue'}
              </button>
            </div>
          </form>
        ) : step === PROFILE_STEPS.length + 1 ? (
          <div className="flex flex-col gap-6">
            <PhotoManager photos={profile.photos} onChange={() => mutate()} />
            <div className="flex justify-between gap-3">
              <button type="button" className="btn-ghost" onClick={() => go(step - 1)}>
                Back
              </button>
              <button type="button" className="btn-primary px-8" onClick={() => go(step + 1)}>
                {profile.photos.length ? 'Continue' : 'Skip for now'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <PreferencesForm initial={profile.preference} submitLabel="Save preferences" onSaved={() => mutate()} />
            <hr className="border-sand-line" />
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="btn-ghost" onClick={() => go(step - 1)}>
                Back
              </button>
              <div className="flex flex-col items-end gap-1">
                <button type="button" className="btn-gold px-8" disabled={busy} onClick={submit}>
                  {busy ? 'Submitting…' : 'Submit profile for review'}
                </button>
                <span className="text-xs text-ink-muted">Save your preferences first. You can change them any time.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
