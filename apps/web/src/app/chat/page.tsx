'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ProfilePhoto } from '@/components/ProfileCard';
import { Empty, Loading, PageTitle } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import { formatDate } from '@/lib/labels';
import type { ProfileCard } from '@/lib/types';

interface ChatRow {
  profile: ProfileCard;
  lastMessage: { body: string; fromMe: boolean; createdAt: string } | null;
  unread: number;
}

export default function ChatListPage() {
  const { ready } = useRequireMe();
  const { data } = useSWR<{ items: ChatRow[] }>(ready ? '/chats' : null, fetcher, { refreshInterval: 15_000 });
  if (!ready || !data) return <Loading />;

  return (
    <div className="container-page flex max-w-3xl flex-col gap-8 py-12">
      <PageTitle eyebrow="Messages" title="Chat" />
      {data.items.length === 0 ? (
        <Empty
          title="No conversations yet"
          body="Chat opens once you and another member have accepted an interest."
          action={{ href: '/inbox?box=received', label: 'See interests' }}
        />
      ) : (
        <ul className="card divide-y divide-sand-line">
          {data.items.map((r) => (
            <li key={r.profile.id}>
              <Link href={`/chat/${r.profile.code}`} className="flex items-center gap-4 p-4 text-ink no-underline hover:bg-sand">
                <ProfilePhoto profile={{ ...r.profile, photoLocked: null }} className="h-14 w-14 flex-none rounded-full [&_span]:text-xl" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold">
                      {r.profile.firstName} {r.profile.lastInitial}
                    </span>
                    {r.lastMessage && <span className="flex-none text-xs text-ink-muted">{formatDate(r.lastMessage.createdAt)}</span>}
                  </div>
                  <span className={`truncate text-sm ${r.unread ? 'font-bold text-ink' : 'text-ink-muted'}`}>
                    {r.lastMessage ? `${r.lastMessage.fromMe ? 'You: ' : ''}${r.lastMessage.body}` : 'You’re connected — say namaste!'}
                  </span>
                </div>
                {r.unread > 0 && (
                  <span className="badge bg-maroon text-ivory" aria-label={`${r.unread} unread`}>
                    {r.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
