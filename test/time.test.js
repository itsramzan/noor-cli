import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  localizeNumber,
  padTwo,
  toBengaliDigits,
} from '../src/utils/numbers.js';
import {
  formatClock,
  formatClockParts,
  formatDuration,
  parseClock,
  timezoneOffsetLabel,
} from '../src/utils/time.js';

test('Bengali digit conversion preserves punctuation and signs', () => {
  assert.equal(toBengaliDigits('1433'), '১৪৩৩');
  assert.equal(toBengaliDigits('-3.5 (UTC+06:00)'), '-৩.৫ (UTC+০৬:০০)');
  assert.equal(localizeNumber(42, 'en'), '42');
  assert.equal(localizeNumber(42, 'bn'), '৪২');
  assert.equal(padTwo(7, 'bn'), '০৭');
});

test('parseClock supports 24-hour values, AM/PM, and timezone suffixes', () => {
  assert.deepEqual(parseClock('04:44'), { hour: 4, minute: 44, second: 0 });
  assert.deepEqual(parseClock('04:44 (BST)'), { hour: 4, minute: 44, second: 0 });
  assert.deepEqual(parseClock('12:00 AM'), { hour: 0, minute: 0, second: 0 });
  assert.deepEqual(parseClock('12:30 PM'), { hour: 12, minute: 30, second: 0 });
  assert.deepEqual(parseClock('11:59 PM'), { hour: 23, minute: 59, second: 0 });
  assert.equal(parseClock('25:00'), null);
  assert.equal(parseClock('noon'), null);
});

test('12h and 24h formatting, including Bangla numerals', () => {
  const time = DateTime.fromISO('2026-10-25T17:24:00', { zone: 'Asia/Dhaka' });
  assert.equal(formatClock(time, '12h', 'en', false), '05:24 PM');
  assert.equal(formatClock(time, '24h', 'en', false), '17:24');
  assert.equal(formatClock(time, '12h', 'bn', false), '০৫:২৪ PM');
  assert.equal(formatClockParts({ hour: 4, minute: 44, second: 0 }, '24h', 'en'), '04:44');
  assert.equal(formatClockParts({ hour: 0, minute: 5, second: 0 }, '12h', 'en'), '12:05 AM');
});

test('duration formatting and timezone offset labels', () => {
  assert.equal(formatDuration(3_723_000), '01h 02m 03s');
  assert.match(formatDuration(5_400_000, 'bn'), /০১ঘ ৩০মি ০০সে/);
  assert.equal(
    timezoneOffsetLabel(DateTime.fromISO('2026-10-25T12:00:00', { zone: 'Asia/Dhaka' })),
    'UTC+06:00',
  );
  assert.equal(
    timezoneOffsetLabel(DateTime.fromISO('2026-10-25T12:00:00', { zone: 'UTC' })),
    'UTC',
  );
});
