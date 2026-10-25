import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  formatBanglaDate,
  getBanglaDate,
  getBanglaMonthLength,
} from '../src/services/banglaCalendar.js';

const zone = 'Asia/Dhaka';

function date(iso) {
  return DateTime.fromISO(iso, { zone });
}

test('new Bangla year starts on 14 April', () => {
  const before = getBanglaDate(date('2019-04-13'), { timezone: zone });
  assert.equal(before.year, 1425);
  assert.equal(before.monthName, 'Chaitra');
  assert.equal(before.day, 30);

  const after = getBanglaDate(date('2019-04-14'), { timezone: zone });
  assert.equal(after.year, 1426);
  assert.equal(after.monthName, 'Boishakh');
  assert.equal(after.day, 1);
});

test('the six 31-day months end Ashwin on 16 October', () => {
  const ashwinEnd = getBanglaDate(date('2026-10-16'), { timezone: zone });
  assert.equal(ashwinEnd.monthName, 'Ashwin');
  assert.equal(ashwinEnd.day, 31);

  const kartikStart = getBanglaDate(date('2026-10-17'), { timezone: zone });
  assert.equal(kartikStart.monthName, 'Kartik');
  assert.equal(kartikStart.day, 1);
});

test('official example: 25 October 2026 is 9 Kartik 1433', () => {
  const info = getBanglaDate(date('2026-10-25'), { timezone: zone });
  assert.equal(info.year, 1433);
  assert.equal(info.monthIndex, 7);
  assert.equal(info.monthName, 'Kartik');
  assert.equal(info.monthNameBn, 'কার্তিক');
  assert.equal(info.day, 9);
  assert.equal(info.daysInMonth, 30);
  assert.equal(formatBanglaDate(info, 'en'), '9 Kartik 1433');
  assert.equal(formatBanglaDate(info, 'bn'), '৯ কার্তিক ১৪৩৩');
});

test('Falgun has 29 days normally and 30 in a Gregorian leap year', () => {
  const leap = getBanglaDate(date('2020-02-29'), { timezone: zone });
  assert.equal(leap.year, 1426);
  assert.equal(leap.monthName, 'Falgun');
  assert.equal(leap.day, 16);
  assert.equal(leap.daysInMonth, 30);

  const normal = getBanglaDate(date('2021-02-28'), { timezone: zone });
  assert.equal(normal.monthName, 'Falgun');
  assert.equal(normal.day, 15);
  assert.equal(normal.daysInMonth, 29);

  const normalEnd = getBanglaDate(date('2026-03-14'), { timezone: zone });
  assert.equal(normalEnd.monthName, 'Falgun');
  assert.equal(normalEnd.day, 29);
  assert.equal(normalEnd.monthNameBn, 'ফাল্গুন');
});

test('Chaitra ends on 13 April and is always 30 days', () => {
  const info = getBanglaDate(date('2019-04-13'), { timezone: zone });
  assert.equal(info.monthName, 'Chaitra');
  assert.equal(info.day, 30);
  assert.equal(info.daysInMonth, 30);
  assert.equal(info.year, 1425);
});

test('January dates belong to the previous Bangla year', () => {
  const info = getBanglaDate(date('2026-01-01'), { timezone: zone });
  assert.equal(info.year, 1432);
  assert.equal(info.monthName, 'Poush');
  assert.equal(info.day, 17);
});

test('month lengths follow the revised Bangladesh calendar', () => {
  assert.equal(getBanglaMonthLength(2026, 1), 31);
  assert.equal(getBanglaMonthLength(2026, 6), 31);
  assert.equal(getBanglaMonthLength(2026, 7), 30);
  assert.equal(getBanglaMonthLength(2026, 10), 30);
  assert.equal(getBanglaMonthLength(2023, 11), 30); // Falgun 1429 (Feb 2024 leap)
  assert.equal(getBanglaMonthLength(2026, 11), 29);
  assert.equal(getBanglaMonthLength(2026, 12), 30);
});
