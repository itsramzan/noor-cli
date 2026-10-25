import { DateTime } from 'luxon';
import { formatBanglaDate, getBanglaDate } from './banglaCalendar.js';
import {
  dateKey,
  formatClock,
  formatEnglishDate,
  formatWeekday,
  timezoneOffsetLabel,
  toZonedDateTime,
} from '../utils/time.js';

/**
 * Build the date/time information used by the dashboard. This is local and
 * never requires the network, so it remains available offline.
 *
 * @param {{now?: DateTime|Date|number|string, timezone: string, language?: 'en'|'bn'}} input
 */
export function createDateInfo(input) {
  const now = toZonedDateTime(input.now ?? DateTime.now(), input.timezone);
  const language = input.language ?? 'en';
  const bangla = getBanglaDate(now, { timezone: input.timezone });

  return {
    now,
    dateKey: dateKey(now),
    timezone: input.timezone,
    offset: timezoneOffsetLabel(now),
    time12: formatClock(now, '12h', language),
    time24: formatClock(now, '24h', language),
    englishDate: formatEnglishDate(now),
    banglaDate: formatBanglaDate(bangla, language),
    banglaDateBn: formatBanglaDate(bangla, 'bn'),
    bangla,
    weekday: formatWeekday(now, language),
  };
}
