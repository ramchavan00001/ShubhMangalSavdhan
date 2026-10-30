import { ageOn } from './age';

/** The subset of profile fields matching looks at. */
export interface MatchableProfile {
  dateOfBirth: Date | null;
  heightCm: number | null;
  maritalStatus: string | null;
  religion: string | null;
  community: string | null;
  motherTongue: string | null;
  state: string | null;
  city: string | null;
  education: string | null;
  profession: string | null;
  diet: string | null;
}

export interface Preference {
  ageMin: number | null;
  ageMax: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  maritalStatuses: string[];
  religions: string[];
  communities: string[];
  motherTongues: string[];
  states: string[];
  cities: string[];
  educations: string[];
  professions: string[];
  diets: string[];
}

type Check = { label: string; set: boolean; ok: boolean };

function listCheck(label: string, wanted: string[], value: string | null): Check {
  return { label, set: wanted.length > 0, ok: wanted.length === 0 || (!!value && wanted.includes(value)) };
}

function rangeCheck(label: string, min: number | null, max: number | null, value: number | null): Check {
  const set = min != null || max != null;
  const ok = !set || (value != null && (min == null || value >= min) && (max == null || value <= max));
  return { label, set, ok };
}

export function preferenceChecks(pref: Preference, p: MatchableProfile, now = new Date()): Check[] {
  const age = p.dateOfBirth ? ageOn(p.dateOfBirth, now) : null;
  return [
    rangeCheck('Age', pref.ageMin, pref.ageMax, age),
    rangeCheck('Height', pref.heightMinCm, pref.heightMaxCm, p.heightCm),
    listCheck('Marital status', pref.maritalStatuses, p.maritalStatus),
    listCheck('Religion', pref.religions, p.religion),
    listCheck('Community', pref.communities, p.community),
    listCheck('Mother tongue', pref.motherTongues, p.motherTongue),
    listCheck('State', pref.states, p.state),
    listCheck('City', pref.cities, p.city),
    listCheck('Education', pref.educations, p.education),
    listCheck('Profession', pref.professions, p.profession),
    listCheck('Diet', pref.diets, p.diet),
  ];
}

/**
 * How well a profile fits someone's preferences, 0–100. Only criteria the person
 * actually set are counted; with no preferences set everyone is a 100% fit.
 */
export function matchPercent(pref: Preference | null, p: MatchableProfile, now = new Date()): number {
  if (!pref) return 100;
  const set = preferenceChecks(pref, p, now).filter((c) => c.set);
  if (set.length === 0) return 100;
  return Math.round((set.filter((c) => c.ok).length / set.length) * 100);
}

const COMPLETENESS_FIELDS = [
  'firstName', 'lastName', 'gender', 'dateOfBirth', 'heightCm', 'maritalStatus', 'religion',
  'community', 'motherTongue', 'state', 'city', 'education', 'profession', 'annualIncome',
  'fatherOccupation', 'motherOccupation', 'familyType', 'familyValues', 'diet', 'aboutMe',
] as const;

/** Profile completeness percentage shown as "Your profile is 70% complete". */
export function profileCompleteness(
  p: Partial<Record<(typeof COMPLETENESS_FIELDS)[number], unknown>>,
  photoCount: number,
  hasPreference: boolean,
): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => p[f] != null && p[f] !== '').length;
  // Fields are worth 70%, a photo 20%, partner preferences 10%.
  const score = (filled / COMPLETENESS_FIELDS.length) * 70 + (photoCount > 0 ? 20 : 0) + (hasPreference ? 10 : 0);
  return Math.round(score);
}

export function profileCode(seq: number): string {
  return `SMS${1000000 + seq}`;
}

export function parseProfileCode(code: string): number | null {
  const m = /^SMS(\d{7,})$/i.exec(code.trim());
  if (!m) return null;
  const seq = Number(m[1]) - 1000000;
  return seq > 0 ? seq : null;
}
