import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { join } from 'node:path';
import { ResponseCache } from '../src/cache.js';
import { createPrayerService } from '../src/services/prayerService.js';
import {
  atLocal,
  baseConfig,
  makeHijriPayload,
  makeTempDir,
  normalizedTimings,
} from './helpers.js';

function createCache(directory) {
  return new ResponseCache({
    path: join(directory, 'cache.json'),
    maxAgeMs: 15 * 60 * 1000,
  });
}

test('fresh data is cached and marked fresh', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  let calls = 0;
  const service = createPrayerService({
    client: {
      async timingsByCity() {
        calls += 1;
        return normalizedTimings();
      },
    },
    cache,
    now: () => atLocal('2026-10-25T04:00:00'),
  });

  const data = await service.getDashboardData({ config: baseConfig() });
  assert.equal(calls, 1);
  assert.equal(data.source, 'fresh');
  assert.equal(data.times.Fajr.hour, 4);
  assert.equal(data.hijri.day, 14);
  assert.equal(data.next.name, 'Fajr');
  assert.ok(data.savedAt);

  const second = await service.getDashboardData({ config: baseConfig() });
  assert.equal(calls, 1);
  assert.equal(second.source, 'cached');
});

test('a failed forced refresh falls back to cached data with warnings', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  let fail = false;
  const service = createPrayerService({
    client: {
      async timingsByCity() {
        if (fail) {
          const error = new Error('offline');
          error.reason = 'network';
          throw error;
        }
        return normalizedTimings();
      },
    },
    cache,
    now: () => atLocal('2026-10-25T04:00:00'),
  });

  await service.getDashboardData({ config: baseConfig() });
  fail = true;
  const data = await service.getDashboardData({
    config: baseConfig(),
    forceRefresh: true,
  });

  assert.equal(data.source, 'cached');
  assert.equal(data.times.Fajr.hour, 4);
  assert.ok(data.warnings.some((warning) => warning.key === 'fetchFailed'));
  assert.ok(data.warnings.some((warning) => warning.key === 'cacheFallback'));
});

test('without a cache, network failure returns no times and no fabrication', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  const service = createPrayerService({
    client: {
      async timingsByCity() {
        const error = new Error('offline');
        error.reason = 'network';
        throw error;
      },
    },
    cache,
    now: () => atLocal('2026-10-25T04:00:00'),
  });

  const data = await service.getDashboardData({ config: baseConfig() });
  assert.equal(data.source, 'none');
  assert.equal(data.times, null);
  assert.equal(data.hijri, null);
  assert.equal(data.next, null);
  assert.ok(data.warnings.some((warning) => warning.key === 'fetchFailed'));
  assert.ok(data.warnings.some((warning) => warning.key === 'noData'));
});

test('after Isha the service fetches tomorrow Fajr and skips events', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  const requestedDates = [];
  const service = createPrayerService({
    client: {
      async timingsByCity(input) {
        const date = input.date.toISODate();
        requestedDates.push(date);
        if (date === '2026-10-26') {
          return normalizedTimings({
            clocks: {
              Fajr: '04:45',
              Sunrise: '06:01',
              Dhuhr: '11:43',
              Asr: '15:01',
              Sunset: '17:25',
              Maghrib: '17:25',
              Isha: '18:41',
            },
          });
        }
        return normalizedTimings();
      },
    },
    cache,
    now: () => atLocal('2026-10-25T19:00:00'),
  });

  const data = await service.getDashboardData({ config: baseConfig() });
  assert.deepEqual(requestedDates, ['2026-10-25', '2026-10-26']);
  assert.equal(data.current.name, 'Isha');
  assert.equal(data.next.name, 'Fajr');
  assert.equal(data.next.isTomorrow, true);
  assert.equal(data.next.time.hour, 4);
  assert.equal(data.next.time.minute, 45);
});

test('a tomorrow fetch failure leaves the countdown unavailable with a warning', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  const service = createPrayerService({
    client: {
      async timingsByCity(input) {
        if (input.date.toISODate() === '2026-10-26') {
          const error = new Error('offline');
          error.reason = 'network';
          throw error;
        }
        return normalizedTimings();
      },
    },
    cache,
    now: () => atLocal('2026-10-25T19:00:00'),
  });

  const data = await service.getDashboardData({ config: baseConfig() });
  assert.equal(data.current.name, 'Isha');
  assert.equal(data.next, null);
  assert.ok(data.warnings.some((warning) => warning.key === 'tomorrow'));
});

test('Hijri adjustment calls the gToH endpoint with the shifted date', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  let hijriRequest = null;
  const service = createPrayerService({
    client: {
      async timingsByCity() {
        return normalizedTimings();
      },
      async gregorianToHijri(input) {
        hijriRequest = input.date.toISODate();
        return makeHijriPayload().data;
      },
    },
    cache,
    now: () => atLocal('2026-10-25T12:00:00'),
  });

  const data = await service.getDashboardData({
    config: baseConfig({ hijriAdjustment: 1 }),
  });

  assert.equal(hijriRequest, '2026-10-26');
  assert.equal(data.hijri.day, 15);
  assert.equal(data.hijriAdjusted, true);
});

test('timezone determines the local day used for HTTP requests', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  let requestedDate = null;
  const service = createPrayerService({
    client: {
      async timingsByCity(input) {
        requestedDate = input.date.toISODate();
        return normalizedTimings();
      },
    },
    cache,
    // 20:00 UTC is already the next day in Dhaka.
    now: () => DateTime.fromISO('2026-10-25T20:00:00', { zone: 'utc' }),
  });

  await service.getDashboardData({ config: baseConfig() });
  assert.equal(requestedDate, '2026-10-26');
});

test('a corrupt cached record is ignored and refetched', async () => {
  const directory = makeTempDir();
  const cache = createCache(directory);
  const config = baseConfig();
  const key = `timings:2026-10-25:dhaka:bangladesh:asia/dhaka:1:1`;
  cache.set(key, { times: { Fajr: 'bad' } });

  const service = createPrayerService({
    client: {
      async timingsByCity() {
        return normalizedTimings();
      },
    },
    cache,
    now: () => atLocal('2026-10-25T12:00:00'),
  });

  const data = await service.getDashboardData({ config });
  assert.equal(data.source, 'fresh');
  assert.equal(data.times.Fajr.hour, 4);
});
