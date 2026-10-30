'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import useSWR from 'swr';
import { Block, Bookmark, Flag, Heart, Phone } from '@/components/icons';
import { ProfilePhoto } from '@/components/ProfileCard';
import { QuotaMeter } from '@/components/QuotaMeter';
import { Alert, Empty, Loading } from '@/components/ui';
import { api, ApiError, fetcher, mediaUrl } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import {
  CREATED_FOR,
  DIET,
  FAMILY_TYPE,
  FAMILY_VALUES,
  feetInches,
  HABIT,
  label,
  MANGLIK,
  MARITAL_STATUS,
  REPORT_REASONS,
} from '@/lib/labels';
import type { Contact, ProfileDetail, Quota, Relationship } from '@/lib/types';

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-sand-line py-2.5 text-[15px] last:border-0">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-semibold">{v || '—'}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="heading mb-3 text-2xl">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

export default function ProfilePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { me, ready } = useRequireMe();
  const { data, error, mutate } = useSWR<{ profile: ProfileDetail; relationship: Relationship }>(ready ? `/profiles/${code}` : null, fetcher);
  const { data: quota, mutate: refreshQuota } = useSWR<Quota>(ready ? '/contacts/quota' : null, fetcher);
  const { data: contactData, mutate: refreshContact } = useSWR<{ unlocked: boolean; contact: Contact | null }>(
    data && !data.relationship.isSelf ? `/contacts/${data.profile.id}` : null,
    fetcher,
  );
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: ReactNode } | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<keyof typeof REPORT_REASONS>('FAKE_PROFILE');
  const [details, setDetails] = useState('');

  if (!ready || (!data && !error)) return <Loading />;
  if (error || !data) {
    return (
      <div className="container-page py-12">
        <Empty title="Profile not found" body="This profile may be hidden, removed, or not available to you." action={{ href: '/matches', label: 'Back to matches' }} />
      </div>
    );
  }

  const { profile: p, relationship: r } = data;
  const isApproved = me?.profile?.status === 'APPROVED';

  async function run(fn: () => Promise<unknown>, success?: ReactNode) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (success) setMsg({ tone: 'success', text: success });
      await Promise.all([mutate(), refreshQuota(), refreshContact()]);
    } catch (e) {
      const err = e as ApiError;
      const upgrade = err.status === 429 && (err.data as { tier?: string } | undefined)?.tier === 'FREE';
      setMsg({
        tone: 'danger',
        text: (
          <>
            {err.message} {(upgrade || /Upgrade/.test(err.message)) && <Link href="/plans">See Premium</Link>}
          </>
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  const sendInterest = () => run(() => api('/interests', { method: 'POST', json: { profileId: p.id } }), 'Interest sent. We’ll let you know when they respond.');
  const respond = (action: 'accept' | 'decline') =>
    run(() => api(`/interests/${r.receivedInterest!.id}/${action}`, { method: 'POST' }), action === 'accept' ? 'You are now connected.' : 'Interest declined.');
  const withdraw = () => run(() => api(`/interests/${r.sentInterest!.id}/withdraw`, { method: 'POST' }), 'Interest withdrawn.');
  const mark = (type: 'SHORTLIST' | 'IGNORE' | 'BLOCK', on: boolean) =>
    run(() => (on ? api('/marks', { method: 'POST', json: { profileId: p.id, type } }) : api(`/marks/${p.id}/${type}`, { method: 'DELETE' })));
  const unlock = () => {
    if (!contactData?.unlocked && quota && quota.remaining > 0) {
      if (!confirm(`Use 1 of your ${quota.remaining} remaining contact unlock${quota.remaining === 1 ? '' : 's'} this week?`)) return;
    }
    return run(() => api(`/contacts/${p.id}/unlock`, { method: 'POST' }));
  };
  const block = async () => {
    if (!confirm(`Block ${p.firstName}? You won’t see each other anywhere on the site.`)) return;
    await run(() => api('/marks', { method: 'POST', json: { profileId: p.id, type: 'BLOCK' } }));
    router.push('/matches');
  };
  const report = () =>
    run(async () => {
      await api('/reports', { method: 'POST', json: { profileId: p.id, reason, details: details || undefined } });
      setReporting(false);
      setDetails('');
    }, 'Thank you. Our team will review this report.');

  const photos = p.photos;
  const current = photos[photoIdx];

  let interestBlock: ReactNode;
  if (r.isSelf) interestBlock = <Link href="/me" className="btn-primary">Edit my profile</Link>;
  else if (r.accepted)
    interestBlock = (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-bold text-success">
          <Heart size={20} /> You are connected
        </p>
        <Link href={`/chat/${p.code}`} className="btn-primary">
          Chat with {p.firstName}
        </Link>
      </div>
    );
  else if (r.receivedInterest?.status === 'PENDING')
    interestBlock = (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{p.firstName} is interested in you.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" disabled={busy || !isApproved} onClick={() => respond('accept')}>Accept</button>
          <button type="button" className="btn-outline flex-1" disabled={busy || !isApproved} onClick={() => respond('decline')}>Decline</button>
        </div>
      </div>
    );
  else if (r.sentInterest?.status === 'PENDING')
    interestBlock = (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink-muted">Interest sent — waiting for a reply.</p>
        <button type="button" className="btn-ghost" disabled={busy} onClick={withdraw}>Withdraw interest</button>
      </div>
    );
  else if (r.sentInterest?.status === 'DECLINED') interestBlock = <p className="text-sm text-ink-muted">{p.firstName} declined your interest.</p>;
  else
    interestBlock = (
      <button type="button" className="btn-primary w-full py-3.5" disabled={busy || !isApproved} onClick={sendInterest}>
        <Heart size={20} /> Send interest
      </button>
    );

  return (
    <div className="container-page flex flex-col gap-6 py-10">
      <Link href="/matches" className="text-sm">
        ← Back to matches
      </Link>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {!isApproved && !r.isSelf && <Alert tone="info">You can send interests and unlock contacts once your profile is approved.</Alert>}

      <div className="flex flex-wrap gap-8">
        {/* Left: photos + actions */}
        <div className="flex w-full flex-col gap-4 md:w-[360px] md:flex-none">
          {current ? (
            <div className="frame-double bg-sand-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(current.url)!} alt={`Photo ${photoIdx + 1} of ${p.firstName}`} className="aspect-[4/5] w-full object-cover" />
            </div>
          ) : (
            <div className="frame-double">
              <ProfilePhoto profile={p} className="aspect-[4/5]" />
            </div>
          )}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((ph, i) => (
                <button key={ph.id} type="button" onClick={() => setPhotoIdx(i)} aria-label={`Show photo ${i + 1}`} className={`h-16 w-14 flex-none border-2 ${i === photoIdx ? 'border-maroon' : 'border-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(ph.url)!} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="card flex flex-col gap-3 p-5">
            {interestBlock}
            {!r.isSelf && (
              <div className="flex gap-2">
                <button type="button" className="btn-ghost flex-1 text-sm" disabled={busy} onClick={() => mark('SHORTLIST', !r.shortlisted)} aria-pressed={r.shortlisted}>
                  <Bookmark size={18} /> {r.shortlisted ? 'Shortlisted' : 'Shortlist'}
                </button>
                <button type="button" className="btn-ghost flex-1 text-sm" disabled={busy} onClick={() => mark('IGNORE', !r.ignored)} aria-pressed={r.ignored}>
                  {r.ignored ? 'Ignored' : 'Not interested'}
                </button>
              </div>
            )}
          </div>

          {!r.isSelf && (
            <div className="card flex flex-col gap-3 p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Phone size={20} className="text-gold-dark" /> Contact details
              </h2>
              {contactData?.unlocked && contactData.contact ? (
                <dl>
                  <Row k="Name" v={contactData.contact.name} />
                  <Row k="Mobile" v={<a href={`tel:${contactData.contact.phone}`}>{contactData.contact.phone}</a>} />
                  {contactData.contact.email && <Row k="Email" v={contactData.contact.email} />}
                  <Row k="Profile managed by" v={label(CREATED_FOR, contactData.contact.createdFor)} />
                </dl>
              ) : p.contactVisibility === 'AFTER_ACCEPT' && !r.accepted ? (
                <p className="text-sm text-ink-muted">{p.firstName} shares contact details only after you’ve both accepted an interest.</p>
              ) : (
                <>
                  {quota && <QuotaMeter quota={quota} compact />}
                  <button type="button" className="btn-gold" disabled={busy || !isApproved || (quota?.remaining ?? 0) === 0} onClick={unlock}>
                    Unlock contact details
                  </button>
                  {quota?.remaining === 0 && quota.tier === 'FREE' && (
                    <p className="text-sm">
                      <Link href="/plans">Upgrade to Premium</Link> for 4 unlocks every week.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: details */}
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="eyebrow">{p.code}</p>
            <h1 className="heading text-4xl sm:text-5xl">
              {p.firstName} {p.lastInitial}
            </h1>
            <p className="text-lg text-ink-muted">
              {[p.age && `${p.age} yrs`, feetInches(p.heightCm), p.city, p.state].filter(Boolean).join(' · ')}
            </p>
            {!r.isSelf && <p className="text-sm font-bold text-gold-dark">{p.matchPercent}% match with your preferences</p>}
          </div>

          {p.aboutMe && (
            <section className="card p-6">
              <h2 className="heading mb-3 text-2xl">About {p.firstName}</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{p.aboutMe}</p>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Basic details">
              <Row k="Profile created by" v={label(CREATED_FOR, p.createdFor)} />
              <Row k="Marital status" v={label(MARITAL_STATUS, p.maritalStatus)} />
              <Row k="Religion" v={p.religion} />
              <Row k="Community" v={[p.community, p.subCaste].filter(Boolean).join(', ')} />
              <Row k="Mother tongue" v={p.motherTongue} />
              <Row k="Manglik" v={label(MANGLIK, p.manglik)} />
            </Section>
            <Section title="Education & career">
              <Row k="Education" v={p.education} />
              <Row k="College" v={p.college} />
              <Row k="Profession" v={p.profession} />
              <Row k="Company" v={p.company} />
              <Row k="Annual income" v={p.annualIncome} />
            </Section>
            <Section title="Family">
              <Row k="Family type" v={label(FAMILY_TYPE, p.familyType)} />
              <Row k="Family values" v={label(FAMILY_VALUES, p.familyValues)} />
              <Row k="Father" v={p.fatherOccupation} />
              <Row k="Mother" v={p.motherOccupation} />
              <Row k="Brothers / sisters" v={`${p.brothers ?? 0} / ${p.sisters ?? 0}`} />
              <Row k="Native place" v={p.nativePlace} />
            </Section>
            <Section title="Lifestyle & location">
              <Row k="Diet" v={label(DIET, p.diet)} />
              <Row k="Smoking" v={label(HABIT, p.smoking)} />
              <Row k="Drinking" v={label(HABIT, p.drinking)} />
              <Row k="Lives in" v={[p.city, p.state, p.country].filter(Boolean).join(', ')} />
              <Row k="Citizenship" v={p.citizenship} />
            </Section>
          </div>

          {!r.isSelf && (
            <div className="flex flex-wrap gap-3 border-t border-sand-line pt-4">
              <button type="button" className="btn-ghost text-sm" onClick={() => setReporting((x) => !x)}>
                <Flag size={18} /> Report profile
              </button>
              <button type="button" className="btn-ghost text-sm text-danger" onClick={block}>
                <Block size={18} /> Block
              </button>
            </div>
          )}
          {reporting && (
            <form
              className="card flex flex-col gap-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                report();
              }}
            >
              <h2 className="text-lg font-bold">Report {p.firstName}</h2>
              <label className="label">
                Reason
                <select className="input" value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REPORT_REASONS)}>
                  {Object.entries(REPORT_REASONS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="label">
                Details (optional)
                <textarea className="input min-h-[100px]" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={busy}>
                  Send report
                </button>
                <button type="button" className="btn-ghost" onClick={() => setReporting(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
