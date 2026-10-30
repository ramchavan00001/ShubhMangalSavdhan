'use client';

import Link from 'next/link';
import { formatDate, timeUntil } from '@/lib/labels';
import type { Quota } from '@/lib/types';

/** "2 of 4 unlocks left this week · Resets in 3 days 5 hrs" */
export function QuotaMeter({ quota, compact }: { quota: Quota; compact?: boolean }) {
  const label = `${quota.remaining} of ${quota.limit} contact unlock${quota.limit === 1 ? '' : 's'} left this week`;
  return (
    <div className={`card flex flex-col gap-3 ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{label}</p>
        <span className={`badge ${quota.tier === 'PREMIUM' ? 'bg-maroon text-gold-light' : 'bg-sand text-ink'}`}>
          {quota.tier === 'PREMIUM' ? 'Universal Premium' : 'Free'}
        </span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${quota.limit}, minmax(0, 1fr))` }} role="img" aria-label={`${quota.used} of ${quota.limit} used`}>
        {Array.from({ length: quota.limit }, (_, i) => (
          <span key={i} className={`h-2.5 rounded-full ${i < quota.used ? 'bg-maroon' : 'bg-sand-line'}`} />
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        {quota.remaining === 0 ? 'Next unlock available in ' : 'Resets in '}
        <strong className="text-ink">{timeUntil(quota.resetsAt)}</strong> ({formatDate(quota.resetsAt, true)}). Unused unlocks don’t carry over.
      </p>
      {quota.tier === 'FREE' && !compact && (
        <p className="text-sm">
          <Link href="/plans">Upgrade to Premium</Link> for 4 unlocks every week, at ₹150 + GST a month.
        </p>
      )}
    </div>
  );
}
