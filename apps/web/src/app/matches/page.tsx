'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { CardGrid, ProfileCard } from '@/components/ProfileCard';
import { StatusBanner } from '@/components/StatusBanner';
import { Empty, Loading, PageTitle, Pager, Tabs } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import type { Paged, ProfileCard as Card } from '@/lib/types';

type Tab = 'all' | 'new' | 'near' | 'recent' | 'viewed-me' | 'shortlisted';

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'My matches' },
  { value: 'new', label: 'New this week' },
  { value: 'near', label: 'Near me' },
  { value: 'recent', label: 'Recently active' },
  { value: 'viewed-me', label: 'Viewed my profile' },
  { value: 'shortlisted', label: 'Shortlisted' },
];

const EMPTY_TEXT: Record<Tab, { title: string; body: string }> = {
  all: { title: 'No matches yet', body: 'Try widening your partner preferences — matches must fit both of you.' },
  new: { title: 'No new matches this week', body: 'New members who fit your preferences will appear here.' },
  near: { title: 'No matches in your city yet', body: 'Matches from your city will appear here.' },
  recent: { title: 'No recently active matches', body: 'Members active in the last 7 days will appear here.' },
  'viewed-me': { title: 'No profile views yet', body: 'Members who view your profile will appear here.' },
  shortlisted: { title: 'Your shortlist is empty', body: 'Tap Shortlist on any profile to save it here.' },
};

export default function MatchesPage() {
  const { me, ready } = useRequireMe();
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR<Paged<Card>>(ready ? `/matches?tab=${tab}&page=${page}` : null, fetcher);

  if (!ready || !me) return <Loading />;

  return (
    <div className="container-page flex flex-col gap-8 py-12">
      <PageTitle eyebrow={`Namaste${me.profile?.firstName ? `, ${me.profile.firstName}` : ''}`} title="Your matches">
        <Link href="/search" className="btn-outline">
          Search with filters
        </Link>
      </PageTitle>
      <StatusBanner me={me} />
      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
      />
      {isLoading || !data ? (
        <Loading />
      ) : data.premiumRequired ? (
        <Empty
          title={`${data.total} member${data.total === 1 ? '' : 's'} viewed your profile`}
          body="Upgrade to Universal Premium to see who they are."
          action={{ href: '/plans', label: 'See Premium' }}
        />
      ) : data.items.length === 0 ? (
        <Empty {...EMPTY_TEXT[tab]} action={tab === 'all' ? { href: '/me?tab=preferences', label: 'Edit preferences' } : undefined} />
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {data.total} profile{data.total === 1 ? '' : 's'}
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
          <Pager page={page} hasMore={data.hasMore} onPage={setPage} />
        </>
      )}
    </div>
  );
}
