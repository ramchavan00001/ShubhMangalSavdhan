/** Human labels for the API's enum values. */

export const CREATED_FOR = {
  SELF: 'Myself',
  SON: 'My son',
  DAUGHTER: 'My daughter',
  BROTHER: 'My brother',
  SISTER: 'My sister',
  RELATIVE: 'A relative',
  FRIEND: 'A friend',
} as const;

export const GENDER = { MALE: 'Male', FEMALE: 'Female' } as const;

export const MARITAL_STATUS = {
  NEVER_MARRIED: 'Never married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  AWAITING_DIVORCE: 'Awaiting divorce',
  ANNULLED: 'Annulled',
} as const;

export const DIET = {
  VEG: 'Vegetarian',
  NON_VEG: 'Non-vegetarian',
  EGGETARIAN: 'Eggetarian',
  JAIN: 'Jain',
  VEGAN: 'Vegan',
} as const;

export const HABIT = { NO: 'No', OCCASIONALLY: 'Occasionally', YES: 'Yes' } as const;
export const FAMILY_TYPE = { JOINT: 'Joint family', NUCLEAR: 'Nuclear family' } as const;
export const FAMILY_VALUES = { TRADITIONAL: 'Traditional', MODERATE: 'Moderate', LIBERAL: 'Liberal' } as const;
export const MANGLIK = { NO: 'No', YES: 'Yes', ANSHIK: 'Anshik (partial)', DONT_KNOW: "Don't know" } as const;

export const PHOTO_VISIBILITY = {
  ALL: 'All members',
  PREMIUM: 'Premium members only',
  ACCEPTED: 'Only members I have connected with',
} as const;

export const CONTACT_VISIBILITY = {
  ALLOW_UNLOCK: 'Members can unlock my contact with a weekly credit',
  AFTER_ACCEPT: 'Only after we accept each other’s interest',
} as const;

export const REPORT_REASONS = {
  FAKE_PROFILE: 'Fake profile',
  ASKING_FOR_MONEY: 'Asking for money',
  ABUSIVE_BEHAVIOUR: 'Abusive or rude behaviour',
  ALREADY_MARRIED: 'Already married',
  INAPPROPRIATE_PHOTOS: 'Inappropriate photos',
  OTHER: 'Something else',
} as const;

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—';
  return map[value] ?? value;
}

/** 165 → 5'5" */
export function feetInches(cm: number | null | undefined): string {
  if (!cm) return '—';
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
}

export const HEIGHT_OPTIONS = Array.from({ length: 213 - 137 + 1 }, (_, i) => 137 + i)
  .filter((cm, i, arr) => i === 0 || Math.round(cm / 2.54) !== Math.round(arr[i - 1] / 2.54))
  .map((cm) => ({ value: cm, label: `${feetInches(cm)} (${cm} cm)` }));

export const AGE_OPTIONS = Array.from({ length: 63 }, (_, i) => 18 + i);

export function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | Date, withTime = false) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

/** "3 days 5 hrs" until a time. */
export function timeUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const days = Math.floor(ms / 86_400_000);
  const hrs = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} ${hrs} hr${hrs === 1 ? '' : 's'}`;
  if (hrs > 0) return `${hrs} hr${hrs === 1 ? '' : 's'} ${mins} min`;
  return `${mins} min`;
}
