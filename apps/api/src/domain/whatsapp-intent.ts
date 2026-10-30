/**
 * Understands members' WhatsApp replies in English, Hinglish, Hindi and Marathi.
 * The result is always one of a few fixed intents; the handler decides what each does.
 */
export type WhatsAppIntent =
  | { kind: 'STOP' }
  | { kind: 'START' }
  | { kind: 'MORE' }
  | { kind: 'HELP' }
  /** "Interested 1 3", "1 aur 3 pasand hai", "Accept", "haan" (numbers empty = answer the latest alert) */
  | { kind: 'YES'; numbers: number[] }
  /** "Skip 2", "not interested", "Decline", "nahi" */
  | { kind: 'NO'; numbers: number[] }
  | { kind: 'UNKNOWN' };

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ') // keep Devanagari vowel signs (\p{M})
    .replace(/\s+/g, ' ')
    .trim();
}

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`(^|\\s)${w}(\\s|$)`, 'u').test(text));

const STOP = ['stop', 'unsubscribe', 'band karo', 'band kar do', 'band', 'बंद', 'बंद करो', 'बंद करा', 'थांबा'];
const START = ['start', 'subscribe', 'chalu karo', 'chalu', 'शुरू', 'चालू', 'चालू करा'];
const HELP = ['help', 'menu', 'madad', 'मदद', 'मदत', 'options'];
const MORE = ['more', 'next', 'aur dikhao', 'aur', 'dikhao', 'aankhi', 'ankhi', 'और', 'और दिखाओ', 'दिखाओ', 'अजून', 'आणखी', 'show more'];
const NO = [
  'not interested', 'no', 'nahi', 'nahin', 'nako', 'skip', 'decline', 'reject', 'pass', 'nai',
  'नहीं', 'नही', 'नको', 'नाही', 'पसंद नहीं', 'नापसंद',
];
const YES = [
  'interested', 'interest', 'accept', 'yes', 'haan', 'han', 'ha', 'ho', 'ok', 'okay', 'like', 'pasand', 'pasant', 'chahiye',
  'हाँ', 'हां', 'हो', 'पसंद', 'पसंत', 'आवडली', 'आवडला', 'स्वीकार', 'मंजूर',
];

export function parseWhatsAppReply(raw: string): WhatsAppIntent {
  const text = normalise(raw);
  if (!text) return { kind: 'UNKNOWN' };
  const numbers = [...new Set((text.match(/\d+/g) ?? []).map(Number).filter((n) => n >= 1 && n <= 20))];

  if (STOP.some((w) => text === w)) return { kind: 'STOP' };
  if (START.some((w) => text === w)) return { kind: 'START' };
  if (HELP.some((w) => text === w)) return { kind: 'HELP' };
  // Negative first: "not interested 2" contains "interested".
  if (has(text, NO)) return { kind: 'NO', numbers };
  if (has(text, YES)) return { kind: 'YES', numbers };
  if (has(text, MORE)) return { kind: 'MORE' };
  // A bare list of numbers ("1 3") answers the digest's "reply with the numbers you like".
  if (numbers.length && /^[\d\s]+$/.test(text.replace(/\b(and|aur|ani|आणि|और)\b/gu, ' '))) return { kind: 'YES', numbers };
  return { kind: 'UNKNOWN' };
}
