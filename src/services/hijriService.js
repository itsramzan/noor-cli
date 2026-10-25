import { DateTime } from 'luxon';
import { localizeNumber, toBengaliDigits } from '../utils/numbers.js';

const HIJRI_MONTHS = Object.freeze([
  { number: 1, en: 'Muharram', bn: 'মুহাররম' },
  { number: 2, en: 'Safar', bn: 'সফর' },
  { number: 3, en: 'Rabi al-Awwal', bn: 'রবিউল আউয়াল' },
  { number: 4, en: 'Rabi al-Thani', bn: 'রবিউস সানি' },
  { number: 5, en: 'Jumada al-Awwal', bn: 'জমাদিউল আউয়াল' },
  { number: 6, en: 'Jumada al-Thani', bn: 'জমাদিউস সানি' },
  { number: 7, en: 'Rajab', bn: 'রজব' },
  { number: 8, en: "Sha'ban", bn: 'শাবান' },
  { number: 9, en: 'Ramadan', bn: 'রমজান' },
  { number: 10, en: 'Shawwal', bn: 'শাওয়াল' },
  { number: 11, en: "Dhul Qa'dah", bn: 'জিলকদ' },
  { number: 12, en: 'Dhul Hijjah', bn: 'জিলহজ' },
]);

export class HijriValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HijriValidationError';
  }
}

export function getHijriMonth(number) {
  return HIJRI_MONTHS.find((month) => month.number === Number(number)) ?? null;
}

export { HIJRI_MONTHS };

/**
 * Normalize an AlAdhan Hijri object into a small, stable shape.
 *
 * @param {unknown} raw
 * @returns {{day: number, month: {number: number, en: string, bn: string}, year: number, dateString: string, weekday: string|null, designation: string|null}}
 */
export function normalizeHijri(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new HijriValidationError('The API did not return a Hijri date.');
  }

  // AlAdhan uses strings for all of these fields.
  const day = Number.parseInt(String(raw.day ?? ''), 10);
  const monthNumber = Number.parseInt(String(raw.month?.number ?? ''), 10);
  const year = Number.parseInt(String(raw.year ?? ''), 10);

  if (!Number.isInteger(day) || day < 1 || day > 30) {
    throw new HijriValidationError('The Hijri day is missing or invalid.');
  }
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new HijriValidationError('The Hijri month is missing or invalid.');
  }
  if (!Number.isInteger(year) || year < 1000 || year > 2000) {
    throw new HijriValidationError('The Hijri year is missing or invalid.');
  }

  const month = getHijriMonth(monthNumber);
  const dateString = typeof raw.date === 'string' && /^\d{1,2}-\d{1,2}-\d{4}$/.test(raw.date)
    ? raw.date
    : `${day}-${monthNumber}-${year}`;

  return {
    day,
    month,
    year,
    dateString,
    weekday: typeof raw.weekday?.en === 'string' ? raw.weekday.en : null,
    designation: typeof raw.designation?.abbr === 'string'
      ? raw.designation.abbr
      : (typeof raw.designation?.en === 'string' ? raw.designation.en : null),
  };
}

export function tryNormalizeHijri(raw) {
  try {
    return normalizeHijri(raw);
  } catch {
    return null;
  }
}

/**
 * @param {{day: number, month: {en: string, bn: string}, year: number}} hijri
 * @param {'en'|'bn'} language
 */
export function formatHijriDate(hijri, language = 'en') {
  if (!hijri) return '';
  if (language === 'bn') {
    return `${toBengaliDigits(hijri.day)} ${hijri.month.bn} ${toBengaliDigits(hijri.year)}`;
  }
  return `${hijri.day} ${hijri.month.en} ${hijri.year}`;
}

export function formatHijriDay(hijri, language = 'en') {
  if (!hijri) return '';
  return localizeNumber(hijri.day, language);
}

export function shiftHijriRequestDate(dateTime, adjustment = 0) {
  if (!DateTime.isDateTime(dateTime) || !dateTime.isValid) {
    throw new RangeError('A valid DateTime is required for a Hijri request.');
  }
  return dateTime.plus({ days: adjustment });
}

/**
 * Resolve the Hijri date for a Gregorian date using AlAdhan data. When the
 * adjustment is zero the Hijri object embedded in the prayer-time response is
 * sufficient. A non-zero adjustment needs a /gToH request for the shifted date.
 *
 * If a non-zero adjustment request fails, the unadjusted API date is returned
 * with an explicit warning instead of inventing a date locally.
 *
 * @param {{client: object, dateTime: DateTime, adjustment?: number, inlineHijri?: unknown}} input
 * @returns {Promise<{hijri: object|null, adjusted: boolean, adjustedDate: string|null, warning: string|null}>}
 */
export async function resolveHijri(input) {
  const adjustment = Number.isInteger(input.adjustment) ? input.adjustment : 0;
  const inline = tryNormalizeHijri(input.inlineHijri);

  if (adjustment === 0 && inline) {
    return {
      hijri: inline,
      adjusted: false,
      adjustedDate: null,
      warning: null,
    };
  }

  try {
    const shifted = shiftHijriRequestDate(input.dateTime, adjustment);
    const payload = await input.client.gregorianToHijri({ date: shifted });
    const hijri = normalizeHijri(payload.hijri);
    return {
      hijri,
      adjusted: adjustment !== 0,
      adjustedDate: shifted.toISODate(),
      warning: null,
    };
  } catch (error) {
    if (inline) {
      return {
        hijri: inline,
        adjusted: false,
        adjustedDate: null,
        warning: adjustment === 0 ? 'hijriMissing' : 'hijriAdjustment',
        error,
      };
    }
    return {
      hijri: null,
      adjusted: false,
      adjustedDate: null,
      warning: 'hijriMissing',
      error,
    };
  }
}
