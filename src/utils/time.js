import { DateTime } from 'luxon';
import { toBengaliDigits } from './numbers.js';

export const BANGLA_WEEKDAYS = Object.freeze([
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
  'শনিবার',
]);

export const ENGLISH_WEEKDAYS = Object.freeze([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

/**
 * Convert supported values to a Luxon DateTime in the requested timezone.
 * Accepts a DateTime, Date, millisecond timestamp, ISO string, or nothing.
 *
 * @param {DateTime|Date|number|string|null|undefined} value
 * @param {string} timezone
 * @returns {DateTime}
 */
export function toZonedDateTime(value, timezone) {
  let dateTime;

  if (DateTime.isDateTime(value)) {
    dateTime = value;
  } else if (value instanceof Date) {
    dateTime = DateTime.fromJSDate(value, { zone: timezone });
  } else if (typeof value === 'number') {
    dateTime = DateTime.fromMillis(value, { zone: timezone });
  } else if (typeof value === 'string') {
    dateTime = DateTime.fromISO(value, { setZone: true });
  } else {
    dateTime = DateTime.now();
  }

  dateTime = dateTime.setZone(timezone);
  if (!dateTime.isValid) {
    throw new RangeError(`Unable to resolve date/time in timezone "${timezone}".`);
  }
  return dateTime;
}

/**
 * Parse an AlAdhan clock value such as "04:44", "4:44 AM", or "04:44 (BST)".
 * Returns null for anything that is not a valid 24-hour clock time.
 *
 * @param {unknown} value
 * @returns {{hour: number, minute: number, second: number}|null}
 */
export function parseClock(value) {
  if (typeof value !== 'string') return null;

  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?(?:\s*\([^)]*\))?$/i);

  if (!match) return null;

  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const second = Number.parseInt(match[3] ?? '0', 10);
  const meridiem = match[4]?.toUpperCase();

  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour < 12) hour += 12;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }

  return { hour, minute, second };
}

export function formatClock(dateTime, timeFormat, language = 'en', includeSeconds = true) {
  const pattern = timeFormat === '24h'
    ? (includeSeconds ? 'HH:mm:ss' : 'HH:mm')
    : (includeSeconds ? 'hh:mm:ss a' : 'hh:mm a');
  const text = dateTime.setLocale('en').toFormat(pattern).replace(/\s+/g, ' ');
  return language === 'bn' ? toBengaliDigits(text) : text;
}

export function formatShortTime(dateTime, timeFormat, language = 'en') {
  return formatClock(dateTime, timeFormat, language, false);
}

/**
 * Format a parsed clock ({hour, minute, second}) for display.
 *
 * @param {{hour: number, minute: number, second?: number}|string} parts
 * @param {'12h'|'24h'} timeFormat
 * @param {'en'|'bn'} language
 * @param {boolean} [includeSeconds]
 */
export function formatClockParts(parts, timeFormat, language = 'en', includeSeconds = false) {
  const parsed = typeof parts === 'string' ? parseClock(parts) : parts;
  if (!parsed) return '—';
  const dateTime = DateTime.fromObject(
    {
      year: 2000,
      month: 1,
      day: 1,
      hour: parsed.hour,
      minute: parsed.minute,
      second: parsed.second ?? 0,
    },
    { zone: 'utc' },
  );
  return formatClock(dateTime, timeFormat, language, includeSeconds);
}

export function formatEnglishDate(dateTime) {
  return dateTime.setLocale('en').toFormat('cccc, d LLLL yyyy');
}

export function formatWeekday(dateTime, language = 'en') {
  const english = ENGLISH_WEEKDAYS[dateTime.weekday % 7];
  const bangla = BANGLA_WEEKDAYS[dateTime.weekday % 7];
  return language === 'bn' ? `${bangla} / ${english}` : `${english} / ${bangla}`;
}

export function formatDuration(milliseconds, language = 'en') {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const values = [];
  if (days > 0) values.push(`${days}d`);
  values.push(`${String(hours).padStart(2, '0')}h`);
  values.push(`${String(minutes).padStart(2, '0')}m`);
  values.push(`${String(seconds).padStart(2, '0')}s`);

  const text = values.join(' ');
  if (language === 'bn') {
    return toBengaliDigits(text)
      .replace('d', 'দিন')
      .replace('h', 'ঘ')
      .replace('m', 'মি')
      .replace('s', 'সে');
  }
  return text;
}

export function formatDateTime(dateTime, language = 'en') {
  const text = dateTime.setLocale('en').toFormat('dd MMM yyyy, hh:mm:ss a');
  return language === 'bn' ? toBengaliDigits(text) : text;
}

export function timezoneOffsetLabel(dateTime) {
  if (dateTime.offset === 0) return 'UTC';
  const sign = dateTime.offset >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(dateTime.offset);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
  const minutes = String(absoluteMinutes % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

export function dateKey(dateTime) {
  return dateTime.toISODate();
}

export function startOfLocalDay(dateTime) {
  return dateTime.startOf('day');
}
