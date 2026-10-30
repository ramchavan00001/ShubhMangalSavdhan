import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidDocNumber, namesMatch } from '../src/domain/id-docs';

describe('ID documents', () => {
  it('validates document number formats', () => {
    assert.ok(isValidDocNumber('PAN', 'abcde1234f'));
    assert.ok(isValidDocNumber('PAN', 'ABCDE 1234 F'));
    assert.ok(!isValidDocNumber('PAN', 'ABCD1234F'));
    assert.ok(isValidDocNumber('PASSPORT', 'K1234567'));
    assert.ok(!isValidDocNumber('PASSPORT', '12345678'));
    assert.ok(isValidDocNumber('DRIVING_LICENCE', 'MH12-20110012345'));
    assert.ok(isValidDocNumber('VOTER_ID', 'abc1234567'));
  });

  it('matches names, allowing middle and father’s names', () => {
    assert.ok(namesMatch('Priya', 'Kulkarni', 'PRIYA RAMESH KULKARNI'));
    assert.ok(namesMatch('Priya', 'Kulkarni', 'Kulkarni Priya'));
    assert.ok(!namesMatch('Priya', 'Kulkarni', 'Priyanka Kulkarni'));
    assert.ok(!namesMatch('Priya', 'Kulkarni', 'Priya Sharma'));
    assert.ok(!namesMatch(null, 'Kulkarni', 'Priya Kulkarni'));
  });
});
