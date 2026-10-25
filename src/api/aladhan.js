import { DateTime } from 'luxon';
import { getVersion } from '../utils/version.js';
import { parseClock } from '../utils/time.js';

const DEFAULT_BASE_URL = 'https://api.aladhan.com/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const REQUIRED_TIMINGS = Object.freeze([
  'Fajr',
  'Sunrise',
  'Dhuhr',
  'Asr',
  'Sunset',
  'Maghrib',
  'Isha',
]);

export class AlAdhanError extends Error {
  /**
   * @param {string} message
   * @param {{reason?: string, status?: number|null, cause?: unknown}} [options]
   */
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AlAdhanError';
    this.reason = options.reason ?? 'unknown';
    this.status = options.status ?? null;
  }
}

export class AlAdhanTimeoutError extends AlAdhanError {
  constructor(message = 'The AlAdhan request timed out.', options = {}) {
    super(message, { ...options, reason: 'timeout' });
    this.name = 'AlAdhanTimeoutError';
  }
}

export class AlAdhanNetworkError extends AlAdhanError {
  constructor(message = 'The AlAdhan API is unreachable.', options = {}) {
    super(message, { ...options, reason: 'network' });
    this.name = 'AlAdhanNetworkError';
  }
}

export class AlAdhanHttpError extends AlAdhanError {
  constructor(status, message = `The AlAdhan API returned HTTP ${status}.`, options = {}) {
    super(message, { ...options, reason: 'http', status });
    this.name = 'AlAdhanHttpError';
  }
}

export class AlAdhanResponseError extends AlAdhanError {
  constructor(message = 'The AlAdhan response failed validation.', options = {}) {
    super(message, { ...options, reason: options.reason ?? 'invalidResponse' });
    this.name = 'AlAdhanResponseError';
  }
}

export class AlAdhanRejectedError extends AlAdhanError {
  constructor(message = 'The AlAdhan API rejected the request.', options = {}) {
    super(message, { ...options, reason: 'rejected' });
    this.name = 'AlAdhanRejectedError';
  }
}

function pad2(number) {
  return String(number).padStart(2, '0');
}

function clockText(parts) {
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/**
 * Format a Luxon DateTime (or an ISO date string) as AlAdhan's DD-MM-YYYY.
 *
 * @param {DateTime|Date|string} value
 * @param {{timezone?: string}} [options]
 * @returns {string}
 */
export function formatApiDate(value, options = {}) {
  let dateTime;

  if (DateTime.isDateTime(value)) {
    dateTime = value;
  } else if (value instanceof Date) {
    dateTime = DateTime.fromJSDate(value, { zone: options.timezone ?? 'utc' });
  } else if (typeof value === 'string') {
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;
    dateTime = DateTime.fromISO(value, { zone: options.timezone ?? 'utc' });
  } else {
    throw new TypeError('A DateTime, Date, or ISO date string is required.');
  }

  if (!dateTime.isValid) {
    throw new RangeError('The supplied date is not valid.');
  }

  return dateTime.toFormat('dd-MM-yyyy');
}

function normalizeTimingsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new AlAdhanResponseError('The API returned an empty response.');
  }

  if (payload.code !== undefined && Number(payload.code) !== 200) {
    throw new AlAdhanRejectedError(
      `The API rejected the request: ${payload.status ?? payload.code}.`,
    );
  }

  if (!payload.data || typeof payload.data !== 'object') {
    throw new AlAdhanResponseError('The API response did not contain a data object.');
  }

  const { data } = payload;
  if (!data.timings || typeof data.timings !== 'object') {
    throw new AlAdhanResponseError('The API response did not contain prayer timings.');
  }

  const times = {};
  const clocks = {};
  const missing = [];

  for (const name of REQUIRED_TIMINGS) {
    const parsed = parseClock(data.timings[name]);
    if (!parsed) {
      missing.push(name);
      continue;
    }
    times[name] = parsed;
    clocks[name] = clockText(parsed);
  }

  if (missing.length > 0) {
    throw new AlAdhanResponseError(
      `The API response is missing a valid time for: ${missing.join(', ')}.`,
    );
  }

  const gregorian = data.date?.gregorian ?? null;
  const hijri = data.date?.hijri ?? null;
  const timezone = data.meta?.timezone ?? null;

  return {
    date: gregorian?.date ?? null,
    readableDate: gregorian?.readable ?? null,
    times,
    clocks,
    hijri,
    timezone,
    method: data.meta?.method ?? null,
    latitude: data.meta?.latitude ?? null,
    longitude: data.meta?.longitude ?? null,
    request: {
      city: data.meta?.city ?? null,
      country: data.meta?.country ?? null,
    },
  };
}

function normalizeHijriPayload(payload, targetDate) {
  if (!payload || typeof payload !== 'object') {
    throw new AlAdhanResponseError('The API returned an empty response.');
  }

  if (payload.code !== undefined && Number(payload.code) !== 200) {
    throw new AlAdhanRejectedError(
      `The API rejected the request: ${payload.status ?? payload.code}.`,
    );
  }

  if (!payload.data || typeof payload.data !== 'object' || !payload.data.hijri) {
    throw new AlAdhanResponseError('The API response did not contain a Hijri date.');
  }

  return {
    hijri: payload.data.hijri,
    gregorian: payload.data.gregorian ?? null,
    targetDate,
  };
}

/**
 * Create an AlAdhan API client. Fetch and timing are injectable so tests never
 * need network access and timeouts are deterministic.
 *
 * @param {{fetchImpl?: Function, timeoutMs?: number, baseUrl?: string}} [options]
 */
export function createAlAdhanClient(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

  async function requestJson(path, query = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new AlAdhanNetworkError('No fetch implementation is available.');
    }

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }

    const queryString = search.toString();
    const url = `${baseUrl}/${path}${queryString ? `?${queryString}` : ''}`;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': `noor-cli/${getVersion()}`,
        },
        signal: controller.signal,
      });

      let text;
      try {
        text = await response.text();
      } catch (error) {
        if (timedOut) throw error;
        throw new AlAdhanNetworkError('The API response could not be read.', {
          cause: error,
        });
      }

      if (!response.ok) {
        throw new AlAdhanHttpError(response.status);
      }

      let payload;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new AlAdhanResponseError('The API returned malformed JSON.', {
          reason: 'invalidJson',
          cause: error,
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof AlAdhanError) throw error;
      if (timedOut || error?.name === 'AbortError') {
        throw new AlAdhanTimeoutError(
          `The AlAdhan request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          { cause: error },
        );
      }
      if (error instanceof TypeError) {
        throw new AlAdhanNetworkError(
          'The AlAdhan API is unreachable. Check the internet connection.',
          { cause: error },
        );
      }
      throw new AlAdhanError('An unexpected error occurred while contacting AlAdhan.', {
        reason: 'unknown',
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    baseUrl,
    timeoutMs,

    /**
     * @param {{date: DateTime|string, city: string, country: string, method: number|string, school: number|string, timezone: string}} input
     */
    async timingsByCity(input) {
      const apiDate = formatApiDate(input.date, { timezone: input.timezone });
      const payload = await requestJson(`timingsByCity/${apiDate}`, {
        city: input.city,
        country: input.country,
        method: input.method,
        school: input.school,
        timezonestring: input.timezone,
      });
      return normalizeTimingsPayload(payload);
    },

    /**
     * Fetch the Hijri date for a Gregorian date. The optional adjustment is
     * applied by shifting the Gregorian request date, not by AlAdhan's
     * adjustment parameter (which only applies to mathematical calendars and
     * uses a different baseline).
     *
     * @param {{date: DateTime|string, adjustment?: number}} input
     */
    async gregorianToHijri(input) {
      const adjustment = Number.isInteger(input.adjustment) ? input.adjustment : 0;
      const base = DateTime.isDateTime(input.date)
        ? input.date
        : DateTime.fromISO(String(input.date), { zone: 'utc' });

      if (!base.isValid) {
        throw new RangeError('A valid date is required for the Hijri request.');
      }

      const target = base.plus({ days: adjustment });
      const apiDate = formatApiDate(target);
      const payload = await requestJson(`gToH/${apiDate}`);
      return normalizeHijriPayload(payload, target.toISODate());
    },
  };
}

export { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS, REQUIRED_TIMINGS };
