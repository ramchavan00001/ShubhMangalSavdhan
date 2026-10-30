import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ageOn, dobRangeForAges } from '../src/domain/age';
import { financialYear, formatInvoiceNumber, splitGst } from '../src/domain/gst';
import { matchPercent, parseProfileCode, profileCode, Preference } from '../src/domain/matching';
import { PREMIUM_PRICE } from '../src/domain/plans';
import { currentQuotaWindow, startOfIstDay } from '../src/domain/quota';
import { normalizeIndianPhone } from '../src/auth/auth.service';
import { containsContactDetails } from '../src/profiles/profiles.service';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);

describe('contact unlock quota', () => {
  const signupAt = at('2026-10-01T10:00:00Z');

  it('free members get 1 unlock per week counted from signup', () => {
    const w = currentQuotaWindow({ now: at('2026-10-09T09:00:00Z'), signupAt });
    assert.equal(w.tier, 'FREE');
    assert.equal(w.limit, 1);
    assert.deepEqual(w.periodStart, at('2026-10-08T10:00:00Z'));
    assert.deepEqual(w.periodEnd, at('2026-10-15T10:00:00Z'));
  });

  it('premium members get 4 per week counted from the payment date', () => {
    const sub = { startsAt: at('2026-10-05T15:30:00Z'), endsAt: at('2026-11-05T15:30:00Z') };
    const w = currentQuotaWindow({ now: at('2026-10-05T16:00:00Z'), signupAt, subscription: sub });
    assert.equal(w.tier, 'PREMIUM');
    assert.equal(w.limit, 4);
    assert.deepEqual(w.periodStart, sub.startsAt);
    assert.deepEqual(w.periodEnd, new Date(sub.startsAt.getTime() + 7 * DAY));

    const w2 = currentQuotaWindow({ now: at('2026-10-13T00:00:00Z'), signupAt, subscription: sub });
    assert.deepEqual(w2.periodStart, new Date(sub.startsAt.getTime() + 7 * DAY));
  });

  it('a 31-day premium month never grants a 5th week', () => {
    const sub = { startsAt: at('2026-10-01T00:00:00Z'), endsAt: at('2026-11-01T00:00:00Z') };
    const day30 = currentQuotaWindow({ now: at('2026-10-30T12:00:00Z'), signupAt, subscription: sub });
    assert.deepEqual(day30.periodStart, at('2026-10-22T00:00:00Z')); // still week 4
    assert.deepEqual(day30.periodEnd, sub.endsAt);
  });

  it('after premium ends, free weeks restart from the end date', () => {
    const sub = { startsAt: at('2026-09-01T00:00:00Z'), endsAt: at('2026-10-01T00:00:00Z') };
    const w = currentQuotaWindow({ now: at('2026-10-03T00:00:00Z'), signupAt: at('2026-08-15T00:00:00Z'), subscription: sub });
    assert.equal(w.tier, 'FREE');
    assert.deepEqual(w.periodStart, sub.endsAt);
  });

  it('premium that has not started yet is not active', () => {
    const sub = { startsAt: at('2026-11-01T00:00:00Z'), endsAt: at('2026-12-01T00:00:00Z') };
    const w = currentQuotaWindow({ now: at('2026-10-20T00:00:00Z'), signupAt, subscription: sub });
    assert.equal(w.tier, 'FREE');
  });

  it('IST day starts at 18:30 UTC', () => {
    assert.deepEqual(startOfIstDay(at('2026-10-29T20:00:00Z')), at('2026-10-29T18:30:00Z'));
    assert.deepEqual(startOfIstDay(at('2026-10-29T10:00:00Z')), at('2026-10-28T18:30:00Z'));
  });
});

describe('pricing and GST', () => {
  it('premium is ₹150 + 18% GST = ₹177', () => {
    assert.equal(PREMIUM_PRICE.basePaise, 15000);
    assert.equal(PREMIUM_PRICE.gstPaise, 2700);
    assert.equal(PREMIUM_PRICE.totalPaise, 17700);
  });

  it('same state → CGST + SGST, other state → IGST', () => {
    assert.deepEqual(splitGst(2700, 'Maharashtra', 'maharashtra'), { kind: 'INTRA', cgstPaise: 1350, sgstPaise: 1350, igstPaise: 0 });
    assert.deepEqual(splitGst(2700, 'Maharashtra', 'Gujarat'), { kind: 'INTER', cgstPaise: 0, sgstPaise: 0, igstPaise: 2700 });
    assert.equal(splitGst(2700, 'Maharashtra', null).kind, 'INTER');
  });

  it('financial year and invoice numbers', () => {
    assert.equal(financialYear(at('2026-10-29T00:00:00Z')), '2026-27');
    assert.equal(financialYear(at('2027-02-10T00:00:00Z')), '2026-27');
    assert.equal(financialYear(at('2027-04-01T00:00:00Z')), '2027-28');
    assert.equal(formatInvoiceNumber('2026-27', 42), 'SMS/2026-27/000042');
  });
});

describe('age', () => {
  it('counts birthdays correctly', () => {
    assert.equal(ageOn(at('2000-10-30T00:00:00Z'), at('2026-10-29T00:00:00Z')), 25);
    assert.equal(ageOn(at('2000-10-29T00:00:00Z'), at('2026-10-29T00:00:00Z')), 26);
  });

  it('date-of-birth range includes both age bounds', () => {
    const on = at('2026-10-29T00:00:00Z');
    const r = dobRangeForAges(25, 30, on);
    // Turned 25 today → included; turns 31 tomorrow → still 30, included.
    assert.ok(at('2001-10-29T00:00:00Z') <= r.lte!);
    assert.ok(at('1995-10-30T00:00:00Z') >= r.gte!);
    assert.ok(at('1995-10-29T00:00:00Z') < r.gte!); // already 31
  });
});

describe('matching', () => {
  const pref: Preference = {
    ageMin: 25, ageMax: 30, heightMinCm: null, heightMaxCm: null, maritalStatuses: [],
    religions: ['Hindu'], communities: [], motherTongues: ['Marathi'], states: [], cities: [],
    educations: [], professions: [], diets: ['VEG'],
  };
  const base = {
    dateOfBirth: at('1999-04-12T00:00:00Z'), heightCm: 163, maritalStatus: 'NEVER_MARRIED', religion: 'Hindu',
    community: 'Maratha', motherTongue: 'Marathi', state: 'Maharashtra', city: 'Pune', education: 'B.E.',
    profession: 'Engineer', diet: 'VEG',
  };

  it('scores only the criteria that were set', () => {
    assert.equal(matchPercent(pref, base, at('2026-10-29T00:00:00Z')), 100);
    assert.equal(matchPercent(pref, { ...base, diet: 'NON_VEG' }, at('2026-10-29T00:00:00Z')), 75);
    assert.equal(matchPercent(null, base), 100);
  });

  it('profile codes round-trip', () => {
    assert.equal(profileCode(1), 'SMS1000001');
    assert.equal(parseProfileCode('sms1000123'), 123);
    assert.equal(parseProfileCode('SMS999'), null);
  });
});

describe('input checks', () => {
  it('normalises Indian mobile numbers', () => {
    assert.equal(normalizeIndianPhone('98765 43210'), '919876543210');
    assert.equal(normalizeIndianPhone('+91-98765-43210'), '919876543210');
    assert.equal(normalizeIndianPhone('09876543210'), '919876543210');
    assert.equal(normalizeIndianPhone('12345'), null);
    assert.equal(normalizeIndianPhone('5876543210'), null);
  });

  it('spots phone numbers and emails in free text', () => {
    assert.ok(containsContactDetails('Call me on 98765 43210'));
    assert.ok(containsContactDetails('mail: priya@example.com'));
    assert.ok(!containsContactDetails('Studied 2015 - 2019 at COEP, 2 brothers'));
  });
});
