/**
 * Government ID formats we accept for verification. The full number is only checked in
 * memory and never stored — we keep the document type and its last 4 characters.
 * Aadhaar is deliberately absent: it may only be collected through a licensed route (DigiLocker).
 */
export const ID_DOCS = {
  PAN: { label: 'PAN card', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, example: 'ABCDE1234F' },
  PASSPORT: { label: 'Passport', pattern: /^[A-Z][0-9]{7}$/, example: 'K1234567' },
  DRIVING_LICENCE: { label: 'Driving licence', pattern: /^[A-Z]{2}[0-9]{2}[0-9A-Z]{11,13}$/, example: 'MH1220110012345' },
  VOTER_ID: { label: 'Voter ID (EPIC)', pattern: /^[A-Z]{3}[0-9]{7}$/, example: 'ABC1234567' },
} as const;

export type IdDocType = keyof typeof ID_DOCS;

export function normaliseDocNumber(raw: string) {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidDocNumber(type: IdDocType, raw: string) {
  return ID_DOCS[type].pattern.test(normaliseDocNumber(raw));
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

/**
 * Does the name on the document belong to the profile? First name must match, and the
 * surname must appear too (documents often add a middle or father's name).
 */
export function namesMatch(profileFirst: string | null, profileLast: string | null, onDoc: string) {
  const doc = new Set(tokens(onDoc));
  const first = tokens(profileFirst ?? '');
  const last = tokens(profileLast ?? '');
  if (!first.length || !last.length) return false;
  return first.every((t) => doc.has(t)) && last.every((t) => doc.has(t));
}
