import { Diet, MaritalStatus, PartnerPreference, Prisma, Profile } from '@prisma/client';
import { ageOn, dobRangeForAges } from '../domain/age';

/** Candidate fits MY preferences. */
export function fitsPreferenceWhere(pref: PartnerPreference | null): Prisma.ProfileWhereInput {
  if (!pref) return {};
  const and: Prisma.ProfileWhereInput[] = [];
  if (pref.ageMin != null || pref.ageMax != null) and.push({ dateOfBirth: dobRangeForAges(pref.ageMin, pref.ageMax) });
  if (pref.heightMinCm != null) and.push({ heightCm: { gte: pref.heightMinCm } });
  if (pref.heightMaxCm != null) and.push({ heightCm: { lte: pref.heightMaxCm } });
  if (pref.maritalStatuses.length) and.push({ maritalStatus: { in: pref.maritalStatuses } });
  if (pref.diets.length) and.push({ diet: { in: pref.diets } });
  if (pref.religions.length) and.push({ religion: { in: pref.religions } });
  if (pref.communities.length) and.push({ community: { in: pref.communities } });
  if (pref.motherTongues.length) and.push({ motherTongue: { in: pref.motherTongues } });
  if (pref.states.length) and.push({ state: { in: pref.states } });
  if (pref.cities.length) and.push({ city: { in: pref.cities } });
  if (pref.educations.length) and.push({ education: { in: pref.educations } });
  if (pref.professions.length) and.push({ profession: { in: pref.professions } });
  return { AND: and };
}

function anyOrHas(field: keyof PartnerPreference, value: string | null): Prisma.PartnerPreferenceWhereInput {
  const empty = { [field]: { isEmpty: true } } as Prisma.PartnerPreferenceWhereInput;
  if (!value) return empty;
  return { OR: [empty, { [field]: { has: value } } as Prisma.PartnerPreferenceWhereInput] };
}

function boundOk(field: 'ageMin' | 'heightMinCm', value: number | null, op: 'lte'): Prisma.PartnerPreferenceWhereInput;
function boundOk(field: 'ageMax' | 'heightMaxCm', value: number | null, op: 'gte'): Prisma.PartnerPreferenceWhereInput;
function boundOk(field: string, value: number | null, op: 'lte' | 'gte'): Prisma.PartnerPreferenceWhereInput {
  const unset = { [field]: null } as Prisma.PartnerPreferenceWhereInput;
  if (value == null) return unset;
  return { OR: [unset, { [field]: { [op]: value } } as Prisma.PartnerPreferenceWhereInput] };
}

/** I fit the CANDIDATE's preferences (a candidate with no preferences accepts everyone). */
export function iFitTheirPreferenceWhere(me: Profile): Prisma.ProfileWhereInput {
  const myAge = me.dateOfBirth ? ageOn(me.dateOfBirth) : null;
  const theirs: Prisma.PartnerPreferenceWhereInput = {
    AND: [
      boundOk('ageMin', myAge, 'lte'),
      boundOk('ageMax', myAge, 'gte'),
      boundOk('heightMinCm', me.heightCm, 'lte'),
      boundOk('heightMaxCm', me.heightCm, 'gte'),
      me.maritalStatus
        ? { OR: [{ maritalStatuses: { isEmpty: true } }, { maritalStatuses: { has: me.maritalStatus as MaritalStatus } }] }
        : { maritalStatuses: { isEmpty: true } },
      me.diet
        ? { OR: [{ diets: { isEmpty: true } }, { diets: { has: me.diet as Diet } }] }
        : { diets: { isEmpty: true } },
      anyOrHas('religions', me.religion),
      anyOrHas('communities', me.community),
      anyOrHas('motherTongues', me.motherTongue),
      anyOrHas('states', me.state),
      anyOrHas('cities', me.city),
      anyOrHas('educations', me.education),
      anyOrHas('professions', me.profession),
    ],
  };
  return { OR: [{ preference: { is: null } }, { preference: { is: theirs } }] };
}
