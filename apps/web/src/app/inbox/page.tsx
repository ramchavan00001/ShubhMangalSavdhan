'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import useSWR from 'swr';
import { CardGrid, ProfileCard } from '@/components/ProfileCard';
import { Alert, Empty, Loading, PageTitle, Tabs } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import { formatDate } from '@/lib/labels';
import type { ProfileCard as Card } from '@/lib/types';

type Box = 'received' | 'sent' | 'accepted' | 'declined';
interface InboxItem {
  id: string;
  status: string;
  message: string | null;
  direction: 'sent' | 'received';
  createdAt: string;
  profile: Card;
}

const EMPTY: Record<Box, string> = {
  received: 'No new interests yet. A complete profile with photos gets noticed more.',
  sent: 'You have no pending sent interests.',
  accepted: 'Accepted interests appear here. You can then unlock contact details.',
  declined: 'Nothing here.',
};

function InboxInner() {
  const { me, ready } = useRequireMe();
  const params = useSearchParams();
  const router = useRouter();
  const box = (params.get('box') as Box) ?? 'received';
  const { data, mutate } = useSWR<{ items: InboxItem[]; pendingReceived: number }>(ready ? `/interests?box=${box}` : null, fetcher);
  const [error, setError] = useState<string | null>(null);
  const approved = me?.profile?.status === 'APPROVED';

  async function act(path: string) {
    setError(null);
    try {
      await api(path, { method: 'POST' });
      await mutate();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!ready) return <Loading />;
  return (
    <div className="container-page flex flex-col gap-8 py-12">
      <PageTitle eyebrow="Inbox" title="Interests" />
      <Tabs<Box>
        tabs={[
          { value: 'received', label: 'Received', count: data?.pendingReceived },
          { value: 'sent', label: 'Sent' },
          { value: 'accepted', label: 'Accepted' },
          { value: 'declined', label: 'Declined' },
        ]}
        value={box}
        onChange={(b) => router.replace(`/inbox?box=${b}`)}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="Nothing here yet" body={EMPTY[box]} action={box === 'received' ? { href: '/matches', label: 'Browse matches' } : undefined} />
      ) : (
        <CardGrid>
          {data.items.map((it) => (
            <ProfileCard key={it.id} profile={it.profile}>
              {it.message && <p className="bg-sand p-3 text-sm italic text-ink-soft">“{it.message}”</p>}
              <p className="text-xs text-ink-muted">
                {it.direction === 'sent' ? 'You sent' : 'Received'} on {formatDate(it.createdAt)}
              </p>
              {box === 'received' && (
                <div className="flex gap-2">
                  <button type="button" className="btn-primary flex-1 text-sm" disabled={!approved} onClick={() => act(`/interests/${it.id}/accept`)}>
                    Accept
                  </button>
                  <button type="button" className="btn-outline flex-1 text-sm" disabled={!approved} onClick={() => act(`/interests/${it.id}/decline`)}>
                    Decline
                  </button>
                </div>
              )}
              {box === 'sent' && (
                <button type="button" className="btn-ghost text-sm" onClick={() => act(`/interests/${it.id}/withdraw`)}>
                  Withdraw
                </button>
              )}
              {box === 'accepted' && (
                <Link href={`/profile/${it.profile.code}`} className="btn-gold text-sm">
                  View contact options
                </Link>
              )}
              {box === 'declined' && it.direction === 'received' && (
                <button type="button" className="btn-ghost text-sm" disabled={!approved} onClick={() => act(`/interests/${it.id}/accept`)}>
                  Changed your mind? Accept
                </button>
              )}
            </ProfileCard>
          ))}
        </CardGrid>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<Loading />}>
      <InboxInner />
    </Suspense>
  );
}
