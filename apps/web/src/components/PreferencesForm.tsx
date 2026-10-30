'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useMasters, values } from '@/lib/hooks';
import { AGE_OPTIONS, DIET, HEIGHT_OPTIONS, MARITAL_STATUS } from '@/lib/labels';
import type { Preference } from '@/lib/types';
import { Alert, enumOpts, MultiSelect, opts } from './ui';

const EMPTY: Preference = {
  ageMin: null, ageMax: null, heightMinCm: null, heightMaxCm: null, maritalStatuses: [], religions: [], communities: [],
  motherTongues: [], states: [], cities: [], educations: [], professions: [], diets: [],
};

/** Partner preferences. Leaving something empty means "any". */
export function PreferencesForm({
  initial,
  submitLabel = 'Save preferences',
  onSaved,
}: {
  initial: Preference | null;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const masters = useMasters();
  const [p, setP] = useState<Preference>({ ...EMPTY, ...(initial ?? {}) });
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Preference>(k: K, v: Preference[K]) => {
    setSaved(false);
    setP((x) => ({ ...x, [k]: v }));
  };

  const communities = (masters?.COMMUNITY ?? [])
    .filter((c) => p.religions.length === 0 || (c.parent && p.religions.includes(c.parent)))
    .map((c) => c.value);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ageMin, ageMax, heightMinCm, heightMaxCm, maritalStatuses, religions, communities: cs, motherTongues, states, cities, educations, professions, diets } = p;
      await api('/profiles/me/preferences', {
        method: 'PUT',
        json: { ageMin, ageMax, heightMinCm, heightMaxCm, maritalStatuses, religions, communities: cs, motherTongues, states, cities, educations, professions, diets },
      });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const numSelect = (label: string, key: 'ageMin' | 'ageMax' | 'heightMinCm' | 'heightMaxCm', options: { value: number; label: string }[]) => (
    <label className="label">
      {label}
      <select className="input" value={p[key] ?? ''} onChange={(e) => set(key, e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const ages = AGE_OPTIONS.map((a) => ({ value: a, label: `${a} years` }));

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <p className="text-sm text-ink-muted">
        Leave anything empty to mean “any”. Matches are shown only when you fit each other’s preferences, so being a little flexible
        brings more matches.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {numSelect('Age from', 'ageMin', ages)}
        {numSelect('Age to', 'ageMax', ages)}
        {numSelect('Height from', 'heightMinCm', HEIGHT_OPTIONS)}
        {numSelect('Height to', 'heightMaxCm', HEIGHT_OPTIONS)}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <MultiSelect label="Religion" options={opts(values(masters, 'RELIGION'))} value={p.religions} onChange={(v) => set('religions', v)} />
        <MultiSelect label="Community" options={opts(communities)} value={p.communities} onChange={(v) => set('communities', v)} />
        <MultiSelect label="Mother tongue" options={opts(values(masters, 'MOTHER_TONGUE'))} value={p.motherTongues} onChange={(v) => set('motherTongues', v)} />
        <MultiSelect label="Marital status" options={enumOpts(MARITAL_STATUS)} value={p.maritalStatuses} onChange={(v) => set('maritalStatuses', v)} />
        <MultiSelect label="State" options={opts(values(masters, 'STATE'))} value={p.states} onChange={(v) => set('states', v)} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-bold text-ink-muted">City</legend>
          <div className="flex flex-wrap gap-2">
            {p.cities.length === 0 && <span className="py-1 text-sm text-ink-muted">Any</span>}
            {p.cities.map((c) => (
              <button key={c} type="button" onClick={() => set('cities', p.cities.filter((x) => x !== c))} className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-maroon px-3 text-sm font-semibold text-ivory" aria-label={`Remove ${c}`}>
                {c} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            <input className="input" placeholder="Type a city and press Add" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Add city" />
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                const c = city.trim();
                if (c && !p.cities.includes(c)) set('cities', [...p.cities, c]);
                setCity('');
              }}
            >
              Add
            </button>
          </div>
        </fieldset>
        <MultiSelect label="Education" options={opts(values(masters, 'EDUCATION'))} value={p.educations} onChange={(v) => set('educations', v)} />
        <MultiSelect label="Profession" options={opts(values(masters, 'PROFESSION'))} value={p.professions} onChange={(v) => set('professions', v)} />
        <MultiSelect label="Diet" options={enumOpts(DIET)} value={p.diets} onChange={(v) => set('diets', v)} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && !onSaved && <Alert tone="success">Preferences saved.</Alert>}
      <div>
        <button type="submit" className="btn-primary px-8" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
