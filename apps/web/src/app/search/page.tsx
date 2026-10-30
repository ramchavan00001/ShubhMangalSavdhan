'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import useSWR from 'swr';
import { CardGrid, ProfileCard } from '@/components/ProfileCard';
import { Alert, Empty, enumOpts, Loading, MultiSelect, opts, PageTitle, Pager } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useMasters, useRequireMe, values } from '@/lib/hooks';
import { AGE_OPTIONS, DIET, HEIGHT_OPTIONS, MARITAL_STATUS } from '@/lib/labels';
import type { Paged, ProfileCard as Card } from '@/lib/types';

const LIST_KEYS = ['religion', 'community', 'motherTongue', 'state', 'education', 'profession', 'maritalStatus', 'diet'] as const;
type ListKey = (typeof LIST_KEYS)[number];

interface Filters {
  ageMin: string;
  ageMax: string;
  heightMin: string;
  heightMax: string;
  city: string;
  withPhoto: boolean;
  sort: string;
  lists: Record<ListKey, string[]>;
}

function fromParams(p: URLSearchParams): Filters {
  const lists = Object.fromEntries(LIST_KEYS.map((k) => [k, (p.get(k) ?? '').split(',').filter(Boolean)])) as Filters['lists'];
  return {
    ageMin: p.get('ageMin') ?? '',
    ageMax: p.get('ageMax') ?? '',
    heightMin: p.get('heightMin') ?? '',
    heightMax: p.get('heightMax') ?? '',
    city: p.get('city') ?? '',
    withPhoto: p.get('withPhoto') === 'true',
    sort: p.get('sort') ?? 'newest',
    lists,
  };
}

function toParams(f: Filters, page: number) {
  const q = new URLSearchParams();
  for (const k of ['ageMin', 'ageMax', 'heightMin', 'heightMax'] as const) if (f[k]) q.set(k, f[k]);
  if (f.city.trim()) q.set('city', f.city.trim());
  if (f.withPhoto) q.set('withPhoto', 'true');
  if (f.sort !== 'newest') q.set('sort', f.sort);
  for (const k of LIST_KEYS) if (f.lists[k].length) q.set(k, f.lists[k].join(','));
  if (page > 1) q.set('page', String(page));
  return q;
}

function SearchInner() {
  const { ready } = useRequireMe();
  const router = useRouter();
  const params = useSearchParams();
  const masters = useMasters();
  const applied = useMemo(() => fromParams(params), [params]);
  const page = Number(params.get('page') ?? 1);
  const [f, setF] = useState<Filters>(applied);
  const [code, setCode] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const query = toParams(applied, page).toString();
  const { data, error, isLoading } = useSWR<Paged<Card>>(ready ? `/search?${query}` : null, fetcher);
  const setList = (k: ListKey, v: string[]) => setF((x) => ({ ...x, lists: { ...x.lists, [k]: v } }));

  function apply(e?: FormEvent) {
    e?.preventDefault();
    setShowFilters(false);
    router.push(`/search?${toParams(f, 1)}`);
  }

  function findById(e: FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/profile/${c.startsWith('SMS') ? c : `SMS${c}`}`);
  }

  const communities = (masters?.COMMUNITY ?? [])
    .filter((c) => f.lists.religion.length === 0 || (c.parent && f.lists.religion.includes(c.parent)))
    .map((c) => c.value);
  const sel = (label: string, key: 'ageMin' | 'ageMax' | 'heightMin' | 'heightMax', options: { value: number; label: string }[]) => (
    <label className="label">
      {label}
      <select className="input" value={f[key]} onChange={(e) => setF((x) => ({ ...x, [key]: e.target.value }))}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  if (!ready) return <Loading />;

  return (
    <div className="container-page flex flex-col gap-8 py-12">
      <PageTitle eyebrow="Search" title="Find your match">
        <form onSubmit={findById} className="flex gap-2" role="search" aria-label="Search by profile ID">
          <input className="input w-48" placeholder="Profile ID, e.g. SMS1000123" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Profile ID" />
          <button type="submit" className="btn-outline">
            Go
          </button>
        </form>
      </PageTitle>

      <div className="flex flex-wrap items-start gap-8">
        <button type="button" className="btn-outline w-full lg:hidden" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
          {showFilters ? 'Hide filters' : 'Show filters'}
        </button>
        <form
          onSubmit={apply}
          className={`card flex w-full flex-col gap-5 p-5 lg:flex lg:w-[300px] lg:flex-none ${showFilters ? 'flex' : 'hidden'}`}
          aria-label="Filters"
        >
          <div className="grid grid-cols-2 gap-3">
            {sel('Age from', 'ageMin', AGE_OPTIONS.map((a) => ({ value: a, label: String(a) })))}
            {sel('Age to', 'ageMax', AGE_OPTIONS.map((a) => ({ value: a, label: String(a) })))}
            {sel('Height from', 'heightMin', HEIGHT_OPTIONS)}
            {sel('Height to', 'heightMax', HEIGHT_OPTIONS)}
          </div>
          <MultiSelect label="Religion" options={opts(values(masters, 'RELIGION'))} value={f.lists.religion} onChange={(v) => setList('religion', v)} />
          <MultiSelect label="Community" options={opts(communities)} value={f.lists.community} onChange={(v) => setList('community', v)} />
          <MultiSelect label="Mother tongue" options={opts(values(masters, 'MOTHER_TONGUE'))} value={f.lists.motherTongue} onChange={(v) => setList('motherTongue', v)} />
          <MultiSelect label="State" options={opts(values(masters, 'STATE'))} value={f.lists.state} onChange={(v) => setList('state', v)} />
          <label className="label">
            City
            <input className="input" value={f.city} onChange={(e) => setF((x) => ({ ...x, city: e.target.value }))} placeholder="e.g. Pune" />
          </label>
          <MultiSelect label="Education" options={opts(values(masters, 'EDUCATION'))} value={f.lists.education} onChange={(v) => setList('education', v)} />
          <MultiSelect label="Profession" options={opts(values(masters, 'PROFESSION'))} value={f.lists.profession} onChange={(v) => setList('profession', v)} />
          <MultiSelect label="Marital status" options={enumOpts(MARITAL_STATUS)} value={f.lists.maritalStatus} onChange={(v) => setList('maritalStatus', v)} />
          <MultiSelect label="Diet" options={enumOpts(DIET)} value={f.lists.diet} onChange={(v) => setList('diet', v)} />
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-maroon" checked={f.withPhoto} onChange={(e) => setF((x) => ({ ...x, withPhoto: e.target.checked }))} />
            Only profiles with photos
          </label>
          <label className="label">
            Sort by
            <select className="input" value={f.sort} onChange={(e) => setF((x) => ({ ...x, sort: e.target.value }))}>
              <option value="newest">Newest first</option>
              <option value="active">Recently active</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              Search
            </button>
            <Link href="/search" className="btn-ghost" onClick={() => setF(fromParams(new URLSearchParams()))}>
              Clear
            </Link>
          </div>
        </form>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          {error ? (
            <Alert tone="danger">{(error as Error).message}</Alert>
          ) : isLoading || !data ? (
            <Loading />
          ) : data.items.length === 0 ? (
            <Empty title="No profiles found" body="Try removing a filter or widening the age range." />
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                {data.total} profile{data.total === 1 ? '' : 's'} found
              </p>
              <CardGrid>
                {data.items.map((p) => (
                  <ProfileCard key={p.id} profile={p}>
                    <Link href={`/profile/${p.code}`} className="btn-outline py-3 text-sm">
                      View profile
                    </Link>
                  </ProfileCard>
                ))}
              </CardGrid>
              <Pager page={page} hasMore={data.hasMore} onPage={(n) => router.push(`/search?${toParams(applied, n)}`)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SearchInner />
    </Suspense>
  );
}
