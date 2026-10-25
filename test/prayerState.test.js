import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPrayerState,
  PRAYER_NAMES,
} from '../src/services/prayerService.js';
import { atLocal } from './helpers.js';

const times = {
  Fajr: '04:44',
  Sunrise: '06:00',
  Dhuhr: '11:42',
  Asr: '15:00',
  Sunset: '17:24',
  Maghrib: '17:24',
  Isha: '18:40',
};

function state(iso, extra = {}) {
  return getPrayerState({
    times,
    now: atLocal(iso),
    timezone: 'Asia/Dhaka',
    ...extra,
  });
}

test('before Fajr the next prayer is Fajr, never Sunrise', () => {
  const result = state('2026-10-25T03:15:00');
  assert.equal(result.next.name, 'Fajr');
  assert.equal(result.next.isTomorrow, false);
  assert.equal(result.current, null);
  assert.equal(result.statuses.Fajr, 'next');
  assert.equal(result.statuses.Sunrise, 'event');
  assert.equal(result.countdownMs, (4 * 60 + 44 - (3 * 60 + 15)) * 60 * 1000);
});

test('during Fajr the window is current and Dhuhr is next', () => {
  const result = state('2026-10-25T05:00:00');
  assert.equal(result.current.name, 'Fajr');
  assert.equal(result.current.endName, 'Sunrise');
  assert.equal(result.statuses.Fajr, 'current');
  assert.equal(result.next.name, 'Dhuhr');
  assert.equal(result.statuses.Sunrise, 'event');
});

test('between Sunrise and Dhuhr there is no current window and Sunrise is skipped', () => {
  const result = state('2026-10-25T09:00:00');
  assert.equal(result.current, null);
  assert.equal(result.next.name, 'Dhuhr');
  assert.equal(result.statuses.Fajr, 'passed');
  assert.equal(result.statuses.Sunrise, 'event');
});

test('Asr and Maghrib windows and the skipped Sunset event', () => {
  const asr = state('2026-10-25T16:00:00');
  assert.equal(asr.current.name, 'Asr');
  assert.equal(asr.next.name, 'Maghrib');
  assert.equal(asr.statuses.Sunset, 'event');

  const maghrib = state('2026-10-25T17:30:00');
  assert.equal(maghrib.current.name, 'Maghrib');
  assert.equal(maghrib.next.name, 'Isha');
});

test('after Isha, tomorrow Fajr is used when supplied', () => {
  const result = state('2026-10-25T19:00:00', {
    tomorrowFajr: { hour: 4, minute: 45, second: 0 },
  });
  assert.equal(result.current.name, 'Isha');
  assert.equal(result.next.name, 'Fajr');
  assert.equal(result.next.isTomorrow, true);
  assert.equal(result.next.time.toISODate(), '2026-10-26');
  assert.equal(result.next.time.hour, 4);
  assert.equal(result.next.time.minute, 45);
  assert.equal(result.statuses.Isha, 'current');
  assert.equal(result.statuses.Fajr, 'passed');
});

test('after Isha without tomorrow data next is unavailable, not estimated', () => {
  const result = state('2026-10-25T23:59:00');
  assert.equal(result.current.name, 'Isha');
  assert.equal(result.next, null);
  assert.equal(result.nextReason, 'tomorrow-unavailable');
  assert.equal(result.countdownMs, null);
});

test('midnight starts a new local day and the next Fajr is today', () => {
  const result = state('2026-10-26T00:01:00');
  assert.equal(result.current, null);
  assert.equal(result.next.name, 'Fajr');
  assert.equal(result.next.isTomorrow, false);
  assert.equal(result.next.time.toISODate(), '2026-10-26');
  assert.equal(result.statuses.Fajr, 'next');
});

test('statuses cover every listed prayer and event, and events are not prayers', () => {
  const result = state('2026-10-25T13:00:00');
  assert.deepEqual(Object.keys(result.statuses).sort(), [...PRAYER_NAMES].sort());
  assert.equal(result.statuses.Sunrise, 'event');
  assert.equal(result.statuses.Sunset, 'event');
  assert.equal(result.next.name, 'Asr');
  assert.equal(result.current.name, 'Dhuhr');
});

test('missing or invalid times are rejected', () => {
  assert.throws(
    () => getPrayerState({
      times: { ...times, Maghrib: 'not a time' },
      now: atLocal('2026-10-25T12:00:00'),
      timezone: 'Asia/Dhaka',
    }),
    /missing or invalid/,
  );
});
