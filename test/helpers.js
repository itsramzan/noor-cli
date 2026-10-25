import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { DateTime } from 'luxon';

export const TEST_TIMEZONE = 'Asia/Dhaka';

export function makeTempDir(prefix = 'noor-test-') {
  const root = '/tmp/opencode';
  mkdirSync(root, { recursive: true });
  return mkdtempSync(join(root, prefix));
}

export function makeTimingsPayload(overrides = {}) {
  const times = {
    Fajr: '04:44',
    Sunrise: '06:00',
    Dhuhr: '11:42',
    Asr: '15:00',
    Sunset: '17:24',
    Maghrib: '17:24',
    Isha: '18:40',
    ...(overrides.timings ?? {}),
  };

  const payload = {
    code: 200,
    status: 'OK',
    data: {
      timings: times,
      date: {
        readable: '25 Oct 2026',
        gregorian: {
          date: '25-10-2026',
          readable: '25 Oct 2026',
        },
        hijri: overrides.hijri === null
          ? undefined
          : {
            date: '14-05-1448',
            day: '14',
            month: {
              number: 5,
              en: 'Jumada al-Awwal',
              ar: 'جمادى الأولى',
            },
            year: '1448',
            weekday: { en: 'Al-Ahad' },
            designation: { abbr: 'AH' },
            ...(overrides.hijri ?? {}),
          },
      },
      meta: {
        timezone: TEST_TIMEZONE,
        latitude: 23.8103,
        longitude: 90.4125,
        method: { id: 1, name: 'University of Islamic Sciences, Karachi' },
        city: 'Dhaka',
        country: 'Bangladesh',
      },
    },
  };

  if (overrides.code !== undefined) payload.code = overrides.code;
  if (overrides.status !== undefined) payload.status = overrides.status;
  return payload;
}

export function makeHijriPayload(hijri = {}) {
  return {
    code: 200,
    status: 'OK',
    data: {
      hijri: {
        date: '15-05-1448',
        day: '15',
        month: { number: 5, en: 'Jumada al-Awwal', ar: 'جمادى الأولى' },
        year: '1448',
        ...hijri,
      },
      gregorian: {
        date: '26-10-2026',
        readable: '26 Oct 2026',
      },
    },
  };
}

export function jsonResponse(payload, status = 200) {
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function atLocal(iso) {
  return DateTime.fromISO(iso, { zone: TEST_TIMEZONE });
}

export function baseConfig(overrides = {}) {
  return {
    city: 'Dhaka',
    country: 'Bangladesh',
    timezone: TEST_TIMEZONE,
    method: 1,
    school: 0,
    language: 'en',
    timeFormat: '12h',
    hijriAdjustment: 0,
    ...overrides,
  };
}

/**
 * Minimal normalized API response used by the service tests.
 */
export function normalizedTimings(overrides = {}) {
  const clocks = {
    Fajr: '04:44',
    Sunrise: '06:00',
    Dhuhr: '11:42',
    Asr: '15:00',
    Sunset: '17:24',
    Maghrib: '17:24',
    Isha: '18:40',
    ...(overrides.clocks ?? {}),
  };

  const times = Object.fromEntries(
    Object.entries(clocks).map(([name, value]) => {
      const [hour, minute] = value.split(':').map(Number);
      return [name, { hour, minute, second: 0 }];
    }),
  );

  return {
    date: '25-10-2026',
    readableDate: '25 Oct 2026',
    times,
    clocks,
    hijri: {
      date: '14-05-1448',
      day: '14',
      month: { number: 5, en: 'Jumada al-Awwal' },
      year: '1448',
    },
    timezone: TEST_TIMEZONE,
    method: { id: 1 },
    ...overrides,
  };
}
