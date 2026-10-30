'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import useSWR from 'swr';
import { Empty, Loading, PageTitle } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import { formatDate } from '@/lib/labels';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const { ready, mutate: refreshMe } = useRequireMe({ needsProfile: false });
  const { data } = useSWR<{ items: Notification[] }>(ready ? '/notifications' : null, fetcher);

  // Opening the page marks everything read (the list still shows which were new).
  useEffect(() => {
    if (data?.items.some((n) => !n.readAt)) api('/notifications/read-all', { method: 'POST' }).then(() => refreshMe());
  }, [data, refreshMe]);

  if (!ready || !data) return <Loading />;
  return (
    <div className="container-page flex max-w-3xl flex-col gap-8 py-12">
      <PageTitle eyebrow="Updates" title="Notifications" />
      {data.items.length === 0 ? (
        <Empty title="No notifications yet" body="Interests, approvals and payment updates will appear here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((n) => (
            <li key={n.id} className={`card flex flex-col gap-1 p-5 ${n.readAt ? '' : 'border-gold'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {!n.readAt && <span className="badge mr-2 bg-gold text-maroon-deep">New</span>}
                  {n.title}
                </p>
                <span className="text-xs text-ink-muted">{formatDate(n.createdAt, true)}</span>
              </div>
              <p className="text-[15px] text-ink-soft">{n.body}</p>
              {n.link && (
                <Link href={n.link} className="text-sm font-semibold">
                  Open
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
