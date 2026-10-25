import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHijriDate,
  getHijriMonth,
  normalizeHijri,
  resolveHijri,
} from '../src/services/hijriService.js';
import { atLocal, makeHijriPayload } from './helpers.js';

test('Hijri normalization converts API strings to numbers', () => {
  const hijri = normalizeHijri({
    date: '14-05-1448',
    day: '14',
    month: { number: 5, en: 'Jumada al-Awwal' },
    year: '1448',
    designation: { abbr: 'AH' },
  });

  assert.equal(hijri.day, 14);
  assert.equal(hijri.month.number, 5);
  assert.equal(hijri.month.en, 'Jumada al-Awwal');
  assert.equal(hijri.month.bn, 'জমাদিউল আউয়াল');
  assert.equal(hijri.year, 1448);
  assert.equal(hijri.designation, 'AH');
});

test('Hijri formatting is localized without changing the underlying date', () => {
  const hijri = normalizeHijri({
    day: '14',
    month: { number: 5 },
    year: '1448',
  });
  assert.equal(formatHijriDate(hijri, 'en'), '14 Jumada al-Awwal 1448');
  assert.equal(formatHijriDate(hijri, 'bn'), '১৪ জমাদিউল আউয়াল ১৪৪৮');
  assert.equal(getHijriMonth(12).en, 'Dhul Hijjah');
});

test('invalid Hijri fields are rejected instead of guessed', () => {
  assert.throws(() => normalizeHijri(null), /did not return/);
  assert.throws(() => normalizeHijri({ day: '31', month: { number: 5 }, year: '1448' }), /day/);
  assert.throws(() => normalizeHijri({ day: '1', month: { number: 13 }, year: '1448' }), /month/);
  assert.throws(() => normalizeHijri({ day: '1', month: { number: 5 }, year: '20' }), /year/);
});

test('adjustment uses the shifted Gregorian date for /gToH', async () => {
  let requestedDate = null;
  const client = {
    async gregorianToHijri(input) {
      requestedDate = input.date.toISODate();
      return makeHijriPayload().data;
    },
  };

  const result = await resolveHijri({
    client,
    dateTime: atLocal('2026-10-25T12:00:00'),
    adjustment: 1,
    inlineHijri: {
      day: '14',
      month: { number: 5 },
      year: '1448',
    },
  });

  assert.equal(requestedDate, '2026-10-26');
  assert.equal(result.hijri.day, 15);
  assert.equal(result.adjusted, true);
  assert.equal(result.adjustedDate, '2026-10-26');
  assert.equal(result.warning, null);
});

test('zero adjustment uses the prayer API Hijri date without another request', async () => {
  let calls = 0;
  const result = await resolveHijri({
    client: {
      async gregorianToHijri() {
        calls += 1;
        throw new Error('should not be called');
      },
    },
    dateTime: atLocal('2026-10-25T12:00:00'),
    adjustment: 0,
    inlineHijri: {
      day: '14',
      month: { number: 5 },
      year: '1448',
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.hijri.day, 14);
  assert.equal(result.adjusted, false);
});

test('a failed adjustment keeps the valid inline date and warns', async () => {
  const result = await resolveHijri({
    client: {
      async gregorianToHijri() {
        throw new Error('offline');
      },
    },
    dateTime: atLocal('2026-10-25T12:00:00'),
    adjustment: 1,
    inlineHijri: {
      day: '14',
      month: { number: 5 },
      year: '1448',
    },
  });

  assert.equal(result.hijri.day, 14);
  assert.equal(result.adjusted, false);
  assert.equal(result.warning, 'hijriAdjustment');
});

test('missing Hijri data returns null with a warning', async () => {
  const result = await resolveHijri({
    client: {
      async gregorianToHijri() {
        throw new Error('offline');
      },
    },
    dateTime: atLocal('2026-10-25T12:00:00'),
    adjustment: 0,
    inlineHijri: null,
  });

  assert.equal(result.hijri, null);
  assert.equal(result.warning, 'hijriMissing');
});
