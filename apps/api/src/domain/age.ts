/** Legal minimum marriage age in India. */
export const MIN_AGE = { FEMALE: 18, MALE: 21 } as const;

export function ageOn(dateOfBirth: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Date-of-birth bounds for "age between min and max today", for database filters.
 * Someone is `max` years old until the day before their (max+1)th birthday.
 */
export function dobRangeForAges(min: number | null | undefined, max: number | null | undefined, on = new Date()) {
  const range: { gte?: Date; lte?: Date } = {};
  if (max != null) {
    const d = new Date(Date.UTC(on.getUTCFullYear() - max - 1, on.getUTCMonth(), on.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 1);
    range.gte = d;
  }
  if (min != null) {
    range.lte = new Date(Date.UTC(on.getUTCFullYear() - min, on.getUTCMonth(), on.getUTCDate()));
  }
  return range;
}
