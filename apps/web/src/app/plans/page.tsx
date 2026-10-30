'use client';

import { PlanCards } from '@/components/PlanCards';
import { Alert } from '@/components/ui';
import { useMe } from '@/lib/hooks';
import { formatDate } from '@/lib/labels';

export default function PlansPage() {
  const { me } = useMe();
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-10 px-4 py-14 sm:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="eyebrow">Plans</p>
        <h1 className="heading text-4xl sm:text-[52px]">One honest price, every community</h1>
        <p className="max-w-xl text-[17px] text-ink-muted">No regional add-ons and no hidden upgrades. Cancel any time — Premium simply doesn’t renew.</p>
      </div>
      {me?.plan.tier === 'PREMIUM' && me.plan.endsAt && (
        <Alert tone="success">You’re on Universal Premium until {formatDate(me.plan.endsAt)}. Renewing early adds another month after that date.</Alert>
      )}
      <PlanCards current={me ? me.plan.tier : undefined} />
      {me?.plan.tier === 'PREMIUM' && (
        <div className="text-center">
          <a href="/checkout" className="btn-outline">
            Renew for another month
          </a>
        </div>
      )}
      <section className="card flex flex-col gap-3 p-6 text-[15px] leading-relaxed text-ink-soft">
        <h2 className="heading text-2xl">How contact unlocks work</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Free members can unlock 1 contact every week. Premium members can unlock 4 every week — 16 in a month.</li>
          <li>Your week starts on the day you sign up (Free) or the day you pay (Premium), and repeats every 7 days.</li>
          <li>If you use all of this week’s unlocks on day one, the next ones open when your new week starts.</li>
          <li>Unused unlocks don’t carry over to the next week.</li>
          <li>Opening a contact you’ve already unlocked is always free.</li>
        </ul>
      </section>
    </div>
  );
}
