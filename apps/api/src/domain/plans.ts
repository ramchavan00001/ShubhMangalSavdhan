/**
 * Plan rules for Shubh Mangal Savdhan. Every number the product promises lives here.
 */

export type PlanTier = 'FREE' | 'PREMIUM';

export interface PlanRules {
  tier: PlanTier;
  name: string;
  /** Contact details that can be unlocked in each 7-day week. Unused ones expire. */
  weeklyContactUnlocks: number;
  /** Interests that can be sent per calendar day (IST). null = unlimited. */
  dailyInterestLimit: number | null;
  canStartChat: boolean;
  canSeeProfileViewers: boolean;
}

export const PLANS: Record<PlanTier, PlanRules> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    weeklyContactUnlocks: 1,
    dailyInterestLimit: 5,
    canStartChat: false,
    canSeeProfileViewers: false,
  },
  PREMIUM: {
    tier: 'PREMIUM',
    name: 'Universal Premium',
    weeklyContactUnlocks: 4,
    dailyInterestLimit: null,
    canStartChat: true,
    canSeeProfileViewers: true,
  },
};

/** ₹150 + 18% GST. Amounts are kept in paise to avoid rounding errors. */
export const PREMIUM_PRICE = {
  basePaise: 15000,
  gstRatePercent: 18,
  get gstPaise() {
    return Math.round((this.basePaise * this.gstRatePercent) / 100);
  },
  get totalPaise() {
    return this.basePaise + this.gstPaise;
  },
};

/** A premium subscription lasts one calendar month and holds 4 unlock weeks. */
export const PREMIUM_WEEKS_PER_SUBSCRIPTION = 4;
