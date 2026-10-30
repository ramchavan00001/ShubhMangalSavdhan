'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { EmailSettings } from '@/components/EmailSettings';
import { Alert, Loading, PageTitle } from '@/components/ui';
import { WhatsAppConsent } from '@/components/WhatsAppConsent';
import { api, fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import { CONTACT_VISIBILITY, PHOTO_VISIBILITY } from '@/lib/labels';
import type { OwnProfile } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const { me, ready, mutate: refreshMe } = useRequireMe();
  const { data: profile, mutate } = useSWR<OwnProfile>(ready ? '/profiles/me' : null, fetcher);
  const [photoVisibility, setPhotoVisibility] = useState<OwnProfile['photoVisibility']>('ALL');
  const [contactVisibility, setContactVisibility] = useState<OwnProfile['contactVisibility']>('ALLOW_UNLOCK');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (profile) {
      setPhotoVisibility(profile.photoVisibility);
      setContactVisibility(profile.contactVisibility);
    }
  }, [profile]);

  if (!ready || !me || !profile) return <Loading />;

  async function savePrivacy(extra: Partial<Pick<OwnProfile, 'hidden'>> = {}) {
    setMsg(null);
    try {
      await api('/profiles/me/privacy', { method: 'PUT', json: { photoVisibility, contactVisibility, ...extra } });
      await Promise.all([mutate(), refreshMe()]);
      setMsg({ tone: 'success', text: 'Settings saved.' });
    } catch (e) {
      setMsg({ tone: 'danger', text: (e as Error).message });
    }
  }

  async function logoutAll() {
    await api('/auth/logout-all', { method: 'POST' });
    await refreshMe(null, { revalidate: false });
    router.push('/login');
  }

  async function deleteAccount() {
    await api('/profiles/me', { method: 'DELETE' });
    await refreshMe(null, { revalidate: false });
    router.push('/?deleted=1');
  }

  const radio = <T extends string>(name: string, map: Record<T, string>, value: T, onChange: (v: T) => void) => (
    <fieldset className="flex flex-col gap-2">
      {(Object.keys(map) as T[]).map((k) => (
        <label key={k} className="flex min-h-[44px] items-center gap-3 text-[15px]">
          <input type="radio" name={name} className="h-5 w-5 accent-maroon" checked={value === k} onChange={() => onChange(k)} />
          {map[k]}
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="container-page flex max-w-3xl flex-col gap-8 py-12">
      <PageTitle eyebrow="Account" title="Settings" />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <section className="card flex flex-col gap-4 p-6">
        <h2 className="heading text-2xl">Who can see my photos</h2>
        {radio('photoVisibility', PHOTO_VISIBILITY, photoVisibility, setPhotoVisibility)}
        <h2 className="heading mt-2 text-2xl">Who can see my contact details</h2>
        {radio('contactVisibility', CONTACT_VISIBILITY, contactVisibility, setContactVisibility)}
        <div>
          <button type="button" className="btn-primary" onClick={() => savePrivacy()}>
            Save privacy settings
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-6">
        <h2 className="heading text-2xl">Email</h2>
        <EmailSettings />
      </section>

      <section className="card flex flex-col gap-4 p-6">
        <h2 className="heading text-2xl">WhatsApp</h2>
        <WhatsAppConsent />
      </section>

      <section className="card flex flex-col gap-3 p-6">
        <h2 className="heading text-2xl">Hide my profile</h2>
        <p className="text-[15px] text-ink-muted">
          {profile.hidden
            ? 'Your profile is hidden. Nobody can find you in matches or search.'
            : 'Taking a break? Hide your profile so nobody can find you. Your data stays safe and you can show it again any time.'}
        </p>
        <div>
          <button type="button" className="btn-outline" onClick={() => savePrivacy({ hidden: !profile.hidden })}>
            {profile.hidden ? 'Show my profile again' : 'Hide my profile'}
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-6">
        <h2 className="heading text-2xl">Sessions</h2>
        <p className="text-[15px] text-ink-muted">Logged in on a shared phone or computer? Log out everywhere.</p>
        <div>
          <button type="button" className="btn-outline" onClick={logoutAll}>
            Log out of all devices
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-3 border-danger p-6">
        <h2 className="font-serif text-2xl font-semibold text-danger">Delete my account</h2>
        <p className="text-[15px] text-ink-muted">
          This permanently deletes your profile, photos, interests and contacts. It can’t be undone. Found your match? Congratulations —
          we’d love to hear your story at the contact page first.
        </p>
        <label className="label">
          Type DELETE to confirm
          <input className="input max-w-xs" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </label>
        <div>
          <button type="button" className="btn bg-danger text-white hover:bg-[#7F1616] hover:text-white" disabled={confirmText !== 'DELETE'} onClick={deleteAccount}>
            Delete my account permanently
          </button>
        </div>
      </section>
    </div>
  );
}
