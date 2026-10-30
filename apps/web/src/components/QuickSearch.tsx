'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useMasters, useMe, values } from '@/lib/hooks';
import { AGE_OPTIONS } from '@/lib/labels';

/** Homepage "Begin your search" card. Logged-out visitors are asked to log in first. */
export function QuickSearch() {
  const router = useRouter();
  const masters = useMasters();
  const { me } = useMe();
  const [ageMin, setAgeMin] = useState('24');
  const [ageMax, setAgeMax] = useState('30');
  const [religion, setReligion] = useState('');
  const [motherTongue, setMotherTongue] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ ageMin, ageMax });
    if (religion) q.set('religion', religion);
    if (motherTongue) q.set('motherTongue', motherTongue);
    const target = `/search?${q}`;
    router.push(me ? target : `/login?signup=1&next=${encodeURIComponent(target)}`);
  }

  return (
    <form onSubmit={submit} className="frame-double flex w-full max-w-[460px] flex-col gap-4 bg-ivory p-6 sm:p-9">
      <h2 className="heading text-[32px] leading-tight">Begin your search</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">
          Age from
          <select className="input" value={ageMin} onChange={(e) => setAgeMin(e.target.value)}>
            {AGE_OPTIONS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Age to
          <select className="input" value={ageMax} onChange={(e) => setAgeMax(e.target.value)}>
            {AGE_OPTIONS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Religion
          <select className="input" value={religion} onChange={(e) => setReligion(e.target.value)}>
            <option value="">Any</option>
            {values(masters, 'RELIGION').map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Mother tongue
          <select className="input" value={motherTongue} onChange={(e) => setMotherTongue(e.target.value)}>
            <option value="">Any</option>
            {values(masters, 'MOTHER_TONGUE').map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" className="btn-primary py-4 text-base">
        Show matches
      </button>
      {!me && <p className="text-center text-xs text-ink-muted">Profiles are visible to registered members only.</p>}
    </form>
  );
}
