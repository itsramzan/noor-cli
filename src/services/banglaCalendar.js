import { DateTime } from 'luxon';
import { toBengaliDigits } from '../utils/numbers.js';

const MONTHS = Object.freeze([
  {
    index: 1,
    bn: 'বৈশাখ',
    en: 'Boishakh',
    seasonBn: 'গ্রীষ্ম',
    seasonEn: 'Summer',
    start: { month: 4, day: 14 },
    yearOffset: 0,
  },
  {
    index: 2,
    bn: 'জ্যৈষ্ঠ',
    en: 'Jyoishtho',
    seasonBn: 'গ্রীষ্ম',
    seasonEn: 'Summer',
    start: { month: 5, day: 15 },
    yearOffset: 0,
  },
  {
    index: 3,
    bn: 'আষাঢ়',
    en: 'Ashar',
    seasonBn: 'বর্ষা',
    seasonEn: 'Monsoon',
    start: { month: 6, day: 15 },
    yearOffset: 0,
  },
  {
    index: 4,
    bn: 'শ্রাবণ',
    en: 'Srabon',
    seasonBn: 'বর্ষা',
    seasonEn: 'Monsoon',
    start: { month: 7, day: 16 },
    yearOffset: 0,
  },
  {
    index: 5,
    bn: 'ভাদ্র',
    en: 'Bhadro',
    seasonBn: 'শরৎ',
    seasonEn: 'Autumn',
    start: { month: 8, day: 16 },
    yearOffset: 0,
  },
  {
    index: 6,
    bn: 'আশ্বিন',
    en: 'Ashwin',
    seasonBn: 'শরৎ',
    seasonEn: 'Autumn',
    start: { month: 9, day: 16 },
    yearOffset: 0,
  },
  {
    index: 7,
    bn: 'কার্তিক',
    en: 'Kartik',
    seasonBn: 'হেমন্ত',
    seasonEn: 'Late Autumn',
    start: { month: 10, day: 17 },
    yearOffset: 0,
  },
  {
    index: 8,
    bn: 'অগ্রহায়ণ',
    en: 'Ogrohayon',
    seasonBn: 'হেমন্ত',
    seasonEn: 'Late Autumn',
    start: { month: 11, day: 16 },
    yearOffset: 0,
  },
  {
    index: 9,
    bn: 'পৌষ',
    en: 'Poush',
    seasonBn: 'শীত',
    seasonEn: 'Winter',
    start: { month: 12, day: 16 },
    yearOffset: 0,
  },
  {
    index: 10,
    bn: 'মাঘ',
    en: 'Magh',
    seasonBn: 'শীত',
    seasonEn: 'Winter',
    start: { month: 1, day: 15 },
    yearOffset: 1,
  },
  {
    index: 11,
    bn: 'ফাল্গুন',
    en: 'Falgun',
    seasonBn: 'বসন্ত',
    seasonEn: 'Spring',
    start: { month: 2, day: 14 },
    yearOffset: 1,
  },
  {
    index: 12,
    bn: 'চৈত্র',
    en: 'Chaitra',
    seasonBn: 'বসন্ত',
    seasonEn: 'Spring',
    start: { month: 3, day: 15 },
    yearOffset: 1,
  },
]);

export { MONTHS as BANGLA_MONTHS };

/**
 * The revised Bangladeshi Bangla calendar starts on 14 April. Boishakh through
 * Ashwin have 31 days, Kartik through Magh have 30, Falgun has 29 days
 * (30 when the following February is in a Gregorian leap year), and Chaitra
 * has 30. Falgun always ends on 14 March and Chaitra always ends on 13 April.
 *
 * @param {DateTime|Date|string|number} value
 * @param {{timezone?: string}} [options]
 * @returns {DateTime}
 */
function resolveDateTime(value, timezone) {
  let dateTime;

  if (DateTime.isDateTime(value)) {
    dateTime = value.setZone(timezone);
  } else if (value instanceof Date) {
    dateTime = DateTime.fromJSDate(value, { zone: timezone });
  } else if (typeof value === 'number') {
    dateTime = DateTime.fromMillis(value, { zone: timezone });
  } else if (typeof value === 'string') {
    dateTime = DateTime.fromISO(value, { zone: timezone, setZone: true }).setZone(timezone);
  } else {
    dateTime = DateTime.now().setZone(timezone);
  }

  if (!dateTime.isValid) {
    throw new RangeError('A valid date is required to calculate the Bangla date.');
  }
  return dateTime;
}

/**
 * @param {DateTime|Date|string|number} value
 * @param {{timezone?: string}} [options]
 */
export function getBanglaDate(value, options = {}) {
  const timezone = options.timezone ?? 'Asia/Dhaka';
  const dateTime = resolveDateTime(value, timezone);
  const dayStart = dateTime.startOf('day');
  const gregorianYear = dayStart.year;

  const startsOnOrAfterBoishakh = dayStart.month > 4
    || (dayStart.month === 4 && dayStart.day >= 14);
  const startYear = startsOnOrAfterBoishakh ? gregorianYear : gregorianYear - 1;
  const year = startYear - 593;

  const starts = MONTHS.map((month) => {
    const start = DateTime.fromObject(
      {
        year: startYear + month.yearOffset,
        month: month.start.month,
        day: month.start.day,
      },
      { zone: timezone },
    ).startOf('day');

    return { month, start };
  });

  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index];
    const next = starts[index + 1]
      ?? {
        month: MONTHS[0],
        start: DateTime.fromObject(
          { year: startYear + 1, month: 4, day: 14 },
          { zone: timezone },
        ).startOf('day'),
      };

    if (dayStart >= current.start && dayStart < next.start) {
      const day = Math.floor(dayStart.diff(current.start, 'days').days) + 1;
      const daysInMonth = Math.round(next.start.diff(current.start, 'days').days);

      return {
        year,
        monthIndex: current.month.index,
        monthName: current.month.en,
        monthNameBn: current.month.bn,
        month: current.month,
        day,
        daysInMonth,
        season: current.month.seasonEn,
        seasonBn: current.month.seasonBn,
        gregorianDate: dayStart.toISODate(),
        timezone,
        startDate: current.start.toISODate(),
        endDate: next.start.minus({ days: 1 }).toISODate(),
      };
    }
  }

  // The fixed month table covers every Gregorian date; this is a safeguard.
  throw new RangeError('Unable to map the date to the Bangla calendar.');
}

/**
 * @param {{day: number, monthName: string, monthNameBn: string, year: number}} info
 * @param {'en'|'bn'} language
 */
export function formatBanglaDate(info, language = 'en') {
  if (!info) return '';
  if (language === 'bn') {
    return `${toBengaliDigits(info.day)} ${info.monthNameBn} ${toBengaliDigits(info.year)}`;
  }
  return `${info.day} ${info.monthName} ${info.year}`;
}

export function getBanglaMonth(index) {
  return MONTHS.find((month) => month.index === index) ?? null;
}

/**
 * Days in a Bangla month for the Bangla year that begins in the supplied
 * Gregorian year. Useful for tests and calendar views.
 *
 * @param {number} gregorianStartYear
 * @param {number} monthIndex 1..12
 */
export function getBanglaMonthLength(gregorianStartYear, monthIndex) {
  const month = getBanglaMonth(monthIndex);
  if (!month) throw new RangeError('Bangla month index must be between 1 and 12.');
  if (!Number.isInteger(gregorianStartYear)) {
    throw new RangeError('A Gregorian start year is required.');
  }

  const start = DateTime.fromObject(
    {
      year: gregorianStartYear + month.yearOffset,
      month: month.start.month,
      day: month.start.day,
    },
    { zone: 'Asia/Dhaka' },
  );
  const next = monthIndex === 12
    ? DateTime.fromObject(
      { year: gregorianStartYear + 1, month: 4, day: 14 },
      { zone: 'Asia/Dhaka' },
    )
    : getBanglaMonth(monthIndex + 1);

  if (monthIndex === 12) {
    return Math.round(next.startOf('day').diff(start.startOf('day'), 'days').days);
  }

  const nextStart = DateTime.fromObject(
    {
      year: gregorianStartYear + next.yearOffset,
      month: next.start.month,
      day: next.start.day,
    },
    { zone: 'Asia/Dhaka' },
  );

  return Math.round(nextStart.startOf('day').diff(start.startOf('day'), 'days').days);
}
