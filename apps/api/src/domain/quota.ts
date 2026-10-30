import { PLANS, PREMIUM_WEEKS_PER_SUBSCRIPTION, PlanTier } from './plans';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface QuotaWindow {
  tier: PlanTier;
  limit: number;
  /** Start of the current unlock week (inclusive). */
  periodStart: Date;
  /** When the next week's credits become available (exclusive end of this week). */
  periodEnd: Date;
}

export interface QuotaInput {
  now: Date;
  /** Free members: weeks are counted from the account's signup time. */
  signupAt: Date;
  /** Active premium subscription, if any. Weeks are counted from its start (payment time). */
  subscription?: { startsAt: Date; endsAt: Date } | null;
}

/**
 * Works out the contact-unlock week a member is in right now.
 *
 * - Weeks are rolling 7-day windows anchored to the payment date (premium) or signup date (free).
 * - Unused credits never carry over: only unlocks inside [periodStart, periodEnd) count.
 * - A premium month has exactly 4 weeks (16 unlocks). Any days after week 4 until the
 *   subscription ends still belong to week 4, so a 30/31-day month never grants a 5th week.
 */
export function currentQuotaWindow({ now, signupAt, subscription }: QuotaInput): QuotaWindow {
  const isPremium =
    !!subscription && subscription.startsAt <= now && now < subscription.endsAt;

  if (isPremium) {
    const anchor = subscription!.startsAt.getTime();
    const weekIndex = Math.min(
      Math.floor((now.getTime() - anchor) / WEEK_MS),
      PREMIUM_WEEKS_PER_SUBSCRIPTION - 1,
    );
    const periodStart = new Date(anchor + weekIndex * WEEK_MS);
    const isLastWeek = weekIndex === PREMIUM_WEEKS_PER_SUBSCRIPTION - 1;
    const periodEnd = isLastWeek
      ? subscription!.endsAt
      : new Date(periodStart.getTime() + WEEK_MS);
    return { tier: 'PREMIUM', limit: PLANS.PREMIUM.weeklyContactUnlocks, periodStart, periodEnd };
  }

  // A free member whose premium just ended starts a fresh free week from that moment,
  // so their week doesn't jump back to an arbitrary point in the old signup cycle.
  const anchorDate =
    subscription && subscription.endsAt <= now && subscription.endsAt > signupAt
      ? subscription.endsAt
      : signupAt;
  const anchor = anchorDate.getTime();
  const weekIndex = Math.max(0, Math.floor((now.getTime() - anchor) / WEEK_MS));
  const periodStart = new Date(anchor + weekIndex * WEEK_MS);
  const periodEnd = new Date(periodStart.getTime() + WEEK_MS);
  return { tier: 'FREE', limit: PLANS.FREE.weeklyContactUnlocks, periodStart, periodEnd };
}

/** Start of "today" in India (IST, UTC+5:30), used for the daily interest limit. */
export function startOfIstDay(now: Date): Date {
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}
