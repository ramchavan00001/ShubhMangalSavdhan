'use client';

import useSWR from 'swr';
import { CardGrid, ProfileCard } from '@/components/ProfileCard';
import { QuotaMeter } from '@/components/QuotaMeter';
import { Empty, Loading, PageTitle } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import { formatDate } from '@/lib/labels';
import type { Contact, ProfileCard as Card, Quota } from '@/lib/types';

export default function ContactsPage() {
  const { ready } = useRequireMe();
  const { data } = useSWR<{ quota: Quota; items: { unlockedAt: string; profile: Card; contact: Contact | null }[] }>(
    ready ? '/contacts' : null,
    fetcher,
  );
  if (!ready || !data) return <Loading />;

  return (
    <div className="container-page flex flex-col gap-8 py-12">
      <PageTitle eyebrow="Contacts" title="Unlocked contacts" />
      <QuotaMeter quota={data.quota} />
      {data.items.length === 0 ? (
        <Empty title="No contacts unlocked yet" body="Open a profile and choose “Unlock contact details”." action={{ href: '/matches', label: 'Browse matches' }} />
      ) : (
        <CardGrid>
          {data.items.map((it) => (
            <ProfileCard key={it.profile.id} profile={it.profile}>
              {it.contact ? (
                <div className="flex flex-col gap-1 bg-sand p-3 text-sm">
                  <span className="font-bold">{it.contact.name}</span>
                  <a href={`tel:${it.contact.phone}`} className="font-semibold">
                    {it.contact.phone}
                  </a>
                  {it.contact.email && <span>{it.contact.email}</span>}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">This member is no longer active.</p>
              )}
              <p className="text-xs text-ink-muted">Unlocked on {formatDate(it.unlockedAt)}</p>
            </ProfileCard>
          ))}
        </CardGrid>
      )}
    </div>
  );
}
