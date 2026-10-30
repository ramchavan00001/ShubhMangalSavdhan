import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseWhatsAppReply as parse } from '../src/domain/whatsapp-intent';

describe('WhatsApp reply parser', () => {
  it('sends interest for numbered replies in many languages', () => {
    assert.deepEqual(parse('Interested 1'), { kind: 'YES', numbers: [1] });
    assert.deepEqual(parse('interested in 2'), { kind: 'YES', numbers: [2] });
    assert.deepEqual(parse('1 aur 3 pasand hai'), { kind: 'YES', numbers: [1, 3] });
    assert.deepEqual(parse('१ और ३ पसंद है'), { kind: 'YES', numbers: [1, 3] });
    assert.deepEqual(parse('2 आवडली'), { kind: 'YES', numbers: [2] });
    assert.deepEqual(parse('1, 3'), { kind: 'YES', numbers: [1, 3] });
    assert.deepEqual(parse('1 and 2'), { kind: 'YES', numbers: [1, 2] });
  });

  it('accepts or declines the latest alert when there are no numbers', () => {
    assert.deepEqual(parse('Accept'), { kind: 'YES', numbers: [] });
    assert.deepEqual(parse('haan ji'), { kind: 'YES', numbers: [] });
    assert.deepEqual(parse('Decline'), { kind: 'NO', numbers: [] });
    assert.deepEqual(parse('नहीं'), { kind: 'NO', numbers: [] });
  });

  it('treats negatives before positives', () => {
    assert.deepEqual(parse('not interested 2'), { kind: 'NO', numbers: [2] });
    assert.deepEqual(parse('skip 2'), { kind: 'NO', numbers: [2] });
    assert.deepEqual(parse('3 nako'), { kind: 'NO', numbers: [3] });
  });

  it('handles more, stop, start and help', () => {
    assert.deepEqual(parse('aur dikhao'), { kind: 'MORE' });
    assert.deepEqual(parse('More!'), { kind: 'MORE' });
    assert.deepEqual(parse('अजून'), { kind: 'MORE' });
    assert.deepEqual(parse('STOP'), { kind: 'STOP' });
    assert.deepEqual(parse('band karo'), { kind: 'STOP' });
    assert.deepEqual(parse('बंद'), { kind: 'STOP' });
    assert.deepEqual(parse('start'), { kind: 'START' });
    assert.deepEqual(parse('menu'), { kind: 'HELP' });
  });

  it('does not stop on messages that merely contain the word', () => {
    assert.notEqual(parse('please do not stop sending').kind, 'STOP');
  });

  it('returns UNKNOWN for anything else', () => {
    assert.deepEqual(parse('what is her height?'), { kind: 'UNKNOWN' });
    assert.deepEqual(parse(''), { kind: 'UNKNOWN' });
    assert.deepEqual(parse('call me at 5'), { kind: 'UNKNOWN' });
  });
});
