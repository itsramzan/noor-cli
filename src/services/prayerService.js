import { DateTime } from 'luxon';
import {
  PRAYER_METHODS,
  SCHOOLS,
} from '../utils/constants.js';
import {
  formatDateTime,
  parseClock,
  toZonedDateTime,
} from '../utils/time.js';
import { makeCacheKey } from '../cache.js';
import { resolveHijri } from './hijriService.js';

export const PRAYER_NAMES = Object.freeze([
  'Fajr',
  'Sunrise',
  'Dhuhr',
  'Asr',
  'Sunset',
  'Maghrib',
  'Isha',
]);

export const OBLIGATORY_PRAYERS = Object.freeze([
  'Fajr',
  'Dhuhr',
  'Asr',
  'Maghrib',
  'Isha',
]);

export const INFORMATIONAL_EVENTS = Object.freeze(['Sunrise', 'Sunset']);

const WINDOW_END = Object.freeze({
  Fajr: 'Sunrise',
  Dhuhr: 'Asr',
  Asr: 'Maghrib',
  Maghrib: 'Isha',
  Isha: null,
});

const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

export class PrayerTimesUnavailableError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'PrayerTimesUnavailableError';
    this.reason = options.reason ?? 'unknown';
  }
}

export function getMethodName(id) {
  return PRAYER_METHODS.find((method) => method.id === Number(id))?.name ?? 'Unknown';
}

export function getMethodShortName(id) {
  return PRAYER_METHODS.find((method) => method.id === Number(id))?.shortName
    ?? getMethodName(id);
}

export function getSchoolName(id, language = 'en') {
  const school = SCHOOLS.find((item) => item.value === Number(id));
  if (!school) return 'Unknown';
  return language === 'bn' ? school.bn : school.name;
}

/**
 * Accept a clock as "04:44", "04:44 (BST)", or a {hour, minute, second} object.
 *
 * @param {unknown} value
 * @returns {{hour: number, minute: number, second: number}|null}
 */
export function coerceClock(value) {
  if (typeof value === 'string') return parseClock(value);
  if (!value || typeof value !== 'object') return null;

  const hour = Number(value.hour);
  const minute = Number(value.minute);
  const second = Number(value.second ?? 0);

  if (
    !Number.isInteger(hour)
    || !Number.isInteger(minute)
    || !Number.isInteger(second)
    || hour < 0
    || hour > 23
    || minute < 0
    || minute > 59
    || second < 0
    || second > 59
  ) {
    return null;
  }

  return { hour, minute, second };
}

function normalizeTimeMap(times) {
  if (!times || typeof times !== 'object') return null;
  const normalized = {};

  for (const name of PRAYER_NAMES) {
    const clock = coerceClock(times[name]);
    if (!clock) return null;
    normalized[name] = clock;
  }

  return normalized;
}

function clockMapFromTimes(times) {
  const clocks = {};
  for (const name of PRAYER_NAMES) {
    const clock = times[name];
    clocks[name] = `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
  }
  return clocks;
}

function dateAtClock(day, clock, timezone) {
  const parts = coerceClock(clock);
  if (!parts) return null;

  return DateTime.fromObject(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
      millisecond: 0,
    },
    { zone: timezone },
  );
}

function buildTomorrowFajr(value, now, timezone) {
  if (!value) return null;

  if (DateTime.isDateTime(value)) {
    return value.setZone(timezone);
  }

  const tomorrow = now.startOf('day').plus({ days: 1 });
  return dateAtClock(tomorrow, value, timezone);
}

/**
 * Build the prayer table state for a single day.
 *
 * - Sunrise and Sunset are informational events and are never returned as the
 *   next prayer.
 * - Prayer windows are Fajr→Sunrise, Dhuhr→Asr, Asr→Maghrib,
 *   Maghrib→Isha, and Isha→midnight.
 * - After Isha, a supplied tomorrow Fajr becomes the next prayer. Without it,
 *   next is null and nextReason explains why; no time is estimated.
 *
 * @param {{times: Record<string, unknown>, now: DateTime|string|Date, timezone?: string, tomorrowFajr?: DateTime|string|object|null}} input
 */
export function getPrayerState(input) {
  const timezone = input.timezone ?? 'UTC';
  const now = toZonedDateTime(input.now, timezone);
  const normalized = normalizeTimeMap(input.times);

  if (!normalized) {
    throw new PrayerTimesUnavailableError('Prayer times are missing or invalid.', {
      reason: 'invalidResponse',
    });
  }

  const day = now.startOf('day');
  const schedule = PRAYER_NAMES.map((name) => ({
    name,
    time: dateAtClock(day, normalized[name], timezone),
    isEvent: INFORMATIONAL_EVENTS.includes(name),
  }));

  const obligatory = schedule.filter((item) => !item.isEvent);
  const nextToday = obligatory.find((item) => item.time > now) ?? null;
  const tomorrow = buildTomorrowFajr(input.tomorrowFajr, now, timezone);

  let next = null;
  let nextReason = null;

  if (nextToday) {
    next = {
      name: nextToday.name,
      time: nextToday.time,
      isTomorrow: false,
    };
  } else if (tomorrow) {
    next = {
      name: 'Fajr',
      time: tomorrow,
      isTomorrow: true,
    };
  } else {
    nextReason = 'tomorrow-unavailable';
  }

  let current = null;
  for (const name of OBLIGATORY_PRAYERS) {
    const start = schedule.find((item) => item.name === name)?.time;
    if (!start) continue;

    const endName = WINDOW_END[name];
    const end = endName
      ? schedule.find((item) => item.name === endName)?.time
      : day.plus({ days: 1 });

    if (end && now >= start && now < end) {
      current = { name, start, end, endName };
      break;
    }
  }

  const statuses = {};
  for (const item of schedule) {
    if (item.isEvent) {
      statuses[item.name] = 'event';
    } else if (current?.name === item.name) {
      statuses[item.name] = 'current';
    } else if (next && !next.isTomorrow && next.name === item.name) {
      statuses[item.name] = 'next';
    } else if (item.time > now) {
      statuses[item.name] = 'upcoming';
    } else {
      statuses[item.name] = 'passed';
    }
  }

  return {
    now,
    day,
    schedule,
    statuses,
    current,
    next,
    nextReason,
    countdownMs: next ? Math.max(0, next.time.toMillis() - now.toMillis()) : null,
    ishaPassed: now >= schedule.find((item) => item.name === 'Isha').time,
  };
}

function isValidCachedRecord(record) {
  return Boolean(
    record
    && typeof record === 'object'
    && record.times
    && normalizeTimeMap(record.times),
  );
}

/**
 * Create the prayer service that coordinates API access, caching, Hijri
 * resolution, and next-prayer state.
 *
 * @param {{client: object, cache?: object|null, ttlMs?: number, now?: () => DateTime|Date|number}} options
 */
export function createPrayerService(options) {
  if (!options?.client) throw new TypeError('An AlAdhan client is required.');
  const client = options.client;
  const cache = options.cache ?? null;
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const nowProvider = options.now ?? (() => DateTime.now());

  function cacheKeyFor(dateTime, config) {
    return makeCacheKey('timings', [
      dateTime.toISODate(),
      config.city,
      config.country,
      config.timezone,
      config.method,
      config.school,
    ]);
  }

  async function getDayRecord(dateTime, config, fetchOptions = {}) {
    const key = cacheKeyFor(dateTime, config);
    const cached = cache?.get(key) ?? null;
    const cachedValid = cached && isValidCachedRecord(cached.value);

    if (cached && !cachedValid) {
      cache?.delete(key);
    }

    if (!fetchOptions.forceRefresh && cachedValid && cached.ageMs <= ttlMs) {
      return {
        record: {
          ...cached.value,
          times: normalizeTimeMap(cached.value.times),
        },
        source: 'cached',
        savedAt: DateTime.fromMillis(cached.savedAtMs).setZone(config.timezone),
        savedAtMs: cached.savedAtMs,
        fallback: false,
        fetchError: null,
      };
    }

    try {
      const response = await client.timingsByCity({
        date: dateTime,
        city: config.city,
        country: config.country,
        method: config.method,
        school: config.school,
        timezone: config.timezone,
      });

      const times = normalizeTimeMap(response.times);
      if (!times) {
        throw new PrayerTimesUnavailableError('The API returned invalid prayer times.', {
          reason: 'invalidResponse',
        });
      }

      const record = {
        dateKey: dateTime.toISODate(),
        times,
        clocks: response.clocks ?? clockMapFromTimes(times),
        hijri: response.hijri ?? null,
        timezone: response.timezone ?? config.timezone,
        method: response.method ?? null,
        savedAt: new Date().toISOString(),
      };

      const cacheEntry = cache?.set(key, record, {
        date: dateTime.toISODate(),
        city: config.city,
        country: config.country,
        method: config.method,
        school: config.school,
      });

      const savedAtMs = cacheEntry?.savedAtMs ?? Date.now();
      return {
        record,
        source: 'fresh',
        savedAt: DateTime.fromMillis(savedAtMs).setZone(config.timezone),
        savedAtMs,
        fallback: false,
        fetchError: null,
      };
    } catch (error) {
      if (cachedValid) {
        return {
          record: {
            ...cached.value,
            times: normalizeTimeMap(cached.value.times),
          },
          source: 'cached',
          savedAt: DateTime.fromMillis(cached.savedAtMs).setZone(config.timezone),
          savedAtMs: cached.savedAtMs,
          fallback: true,
          fetchError: error,
        };
      }

      throw new PrayerTimesUnavailableError(
        error instanceof Error ? error.message : 'Prayer times are unavailable.',
        {
          reason: error?.reason ?? 'unknown',
          cause: error,
        },
      );
    }
  }

  function warningList(...warnings) {
    const seen = new Set();
    return warnings.flat().filter((warning) => {
      if (!warning) return false;
      const key = `${warning.key}:${JSON.stringify(warning.params ?? {})}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cacheFallbackWarnings(result, language) {
    if (!result.fallback || !result.fetchError) return [];
    return [
      {
        key: 'fetchFailed',
        params: { reasonKey: result.fetchError.reason ?? 'unknown' },
      },
      {
        key: 'cacheFallback',
        params: { time: formatDateTime(result.savedAt, language) },
      },
    ];
  }

  return {
    /**
     * @param {{config: typeof import('../utils/constants.js').DEFAULT_CONFIG, now?: DateTime, forceRefresh?: boolean}} input
     */
    async getDashboardData(input) {
      const config = input.config;
      const language = config.language ?? 'en';
      const currentNow = toZonedDateTime(
        input.now ?? nowProvider(),
        config.timezone,
      );
      const timezone = config.timezone;
      const warnings = [];

      let today;
      try {
        today = await getDayRecord(currentNow, config, {
          forceRefresh: Boolean(input.forceRefresh),
        });
      } catch (error) {
        return {
          now: currentNow,
          timezone,
          config,
          source: 'none',
          savedAt: null,
          times: null,
          clocks: null,
          hijri: null,
          hijriAdjusted: false,
          next: null,
          nextReason: null,
          current: null,
          statuses: null,
          countdownMs: null,
          errorReason: error.reason ?? 'unknown',
          warnings: warningList(
            {
              key: 'fetchFailed',
              params: { reasonKey: error.reason ?? 'unknown' },
            },
            { key: 'noData' },
          ),
        };
      }

      warnings.push(...cacheFallbackWarnings(today, language));

      const todayState = getPrayerState({
        times: today.record.times,
        now: currentNow,
        timezone,
      });

      let tomorrowFajr = null;
      let tomorrowFetched = false;

      if (todayState.ishaPassed) {
        const tomorrowDate = currentNow.plus({ days: 1 });
        try {
          const tomorrow = await getDayRecord(tomorrowDate, config);
          tomorrowFajr = tomorrow.record.times.Fajr;
          tomorrowFetched = true;
          warnings.push(...cacheFallbackWarnings(tomorrow, language));
        } catch (error) {
          warnings.push({
            key: 'tomorrow',
            params: { reasonKey: error.reason ?? 'unknown' },
          });
          tomorrowFetched = false;
        }
      }

      const state = tomorrowFetched
        ? getPrayerState({
          times: today.record.times,
          now: currentNow,
          timezone,
          tomorrowFajr,
        })
        : todayState;

      let hijri = null;
      let hijriAdjusted = false;
      try {
        const resolved = await resolveHijri({
          client,
          dateTime: currentNow,
          adjustment: config.hijriAdjustment,
          inlineHijri: today.record.hijri,
        });
        hijri = resolved.hijri;
        hijriAdjusted = resolved.adjusted;
        if (resolved.warning) {
          warnings.push({
            key: resolved.warning,
            params: resolved.warning === 'hijriAdjustment'
              ? { adjustment: config.hijriAdjustment }
              : {},
          });
        }
      } catch (error) {
        warnings.push({ key: 'hijriMissing', params: {} });
      }

      return {
        now: currentNow,
        timezone,
        config,
        source: today.source,
        savedAt: today.savedAt,
        times: today.record.times,
        clocks: today.record.clocks ?? clockMapFromTimes(today.record.times),
        hijri,
        hijriAdjusted,
        next: state.next,
        nextReason: state.nextReason,
        current: state.current,
        statuses: state.statuses,
        countdownMs: state.countdownMs,
        ishaPassed: state.ishaPassed,
        errorReason: null,
        warnings: warningList(warnings),
      };
    },
  };
}

export { DEFAULT_CACHE_TTL_MS };
