import { DateTime } from 'luxon';
import { APP_NAME } from '../utils/constants.js';
import { localizeNumber } from '../utils/numbers.js';
import {
  formatClockParts,
  formatDateTime,
  formatDuration,
  formatShortTime,
} from '../utils/time.js';
import { getVersion } from '../utils/version.js';
import { createDateInfo } from '../services/dateService.js';
import { formatHijriDate } from '../services/hijriService.js';
import {
  getMethodShortName,
  getSchoolName,
  PRAYER_NAMES,
} from '../services/prayerService.js';
import { createTheme } from './colors.js';
import { t } from './i18n.js';
import {
  centerDisplay,
  padDisplay,
  renderPanel,
  renderTable,
  resolveTerminalWidth,
  stringWidth,
  wrapDisplay,
} from './table.js';
import { renderBanner } from './banner.js';

function prayerLabel(language, name) {
  return t(language, `prayer.${name}`);
}

function formatCountdown(milliseconds, language) {
  if (milliseconds === null || milliseconds === undefined) {
    return t(language, 'next.countdownUnavailable');
  }
  return formatDuration(milliseconds, language);
}

function adjustmentText(adjustment, language) {
  if (!adjustment) return t(language, 'api.noAdjustment');
  const sign = adjustment > 0 ? '+' : '-';
  const days = Math.abs(adjustment);
  const unit = days === 1 ? t(language, 'next.day') : t(language, 'next.days');
  return `${sign}${localizeNumber(days, language)} ${unit}`;
}

function styleForStatus(theme, status) {
  if (status === 'next') {
    return (text) => theme.emerald(theme.bold(text));
  }
  if (status === 'current') {
    return (text) => theme.cyan(theme.bold(text));
  }
  if (status === 'passed') {
    return (text) => theme.dim(theme.gray(text));
  }
  if (status === 'event') {
    return (text) => theme.gold(text);
  }
  if (status === 'unavailable') {
    return (text) => theme.red(text);
  }
  return (text) => text;
}

function warningStyle(theme, key) {
  if (key === 'fetchFailed' || key === 'noData') return theme.red;
  if (key === 'tomorrow' || key === 'hijriMissing' || key === 'hijriAdjustment') {
    return theme.gold;
  }
  return theme.gray;
}

function warningMessage(language, warning) {
  const params = { ...(warning.params ?? {}) };
  if (warning.key === 'fetchFailed' && params.reasonKey) {
    params.reason = t(language, `reason.${params.reasonKey}`);
    delete params.reasonKey;
  }
  return t(language, `warning.${warning.key}`, params);
}

function renderInfoPanel({ width, theme, language, config, dateInfo, data }) {
  const infoRows = [
    {
      key: { text: t(language, 'info.localTime'), style: theme.gray },
      value: {
        text: config.timeFormat === '24h' ? dateInfo.time24 : dateInfo.time12,
        style: theme.cyan,
      },
    },
    {
      key: { text: t(language, 'info.englishDate'), style: theme.gray },
      value: { text: dateInfo.englishDate },
    },
    {
      key: { text: t(language, 'info.banglaDate'), style: theme.gray },
      value: { text: dateInfo.banglaDate },
    },
    {
      key: { text: t(language, 'info.hijriDate'), style: theme.gray },
      value: data.hijri
        ? { text: formatHijriDate(data.hijri, language), style: theme.gold }
        : { text: t(language, 'status.unavailable'), style: theme.red },
    },
    {
      key: { text: t(language, 'info.season'), style: theme.gray },
      value: {
        text: language === 'bn' ? dateInfo.bangla.seasonBn : dateInfo.bangla.season,
      },
    },
    {
      key: { text: t(language, 'info.city'), style: theme.gray },
      value: { text: `${config.city}, ${config.country}` },
    },
    {
      key: { text: t(language, 'info.timezone'), style: theme.gray },
      value: { text: `${config.timezone} (${dateInfo.offset})` },
    },
  ];

  const contentWidth = width - 4;
  const table = renderTable({
    columns: [
      { key: 'key', header: '', minWidth: 7, priority: 2 },
      { key: 'value', header: '', minWidth: 7, priority: 1 },
    ],
    rows: infoRows,
    width: contentWidth,
    gap: 2,
    showHeader: false,
    separator: false,
  });

  return renderPanel({
    title: t(language, 'section.dateTime'),
    lines: table,
    width,
    theme,
  });
}

function renderPrayerPanel({ width, theme, language, config, data }) {
  const rows = PRAYER_NAMES.map((name) => {
    const clock = data.times?.[name];
    const status = data.statuses?.[name] ?? 'unavailable';
    return {
      prayer: prayerLabel(language, name),
      time: clock
        ? formatClockParts(clock, config.timeFormat, language)
        : (theme.unicode ? '—' : '-'),
      status: t(language, `status.${status}`),
      _status: status,
    };
  });

  const table = renderTable({
    columns: [
      { key: 'prayer', header: t(language, 'table.prayerEvent'), minWidth: 5, priority: 3 },
      {
        key: 'time',
        header: t(language, 'table.time'),
        minWidth: 5,
        align: 'right',
        priority: 2,
      },
      { key: 'status', header: t(language, 'table.status'), minWidth: 5, priority: 1 },
    ],
    rows,
    width: width - 4,
    gap: 2,
    headerStyle: (text) => theme.gray(theme.bold(text)),
    separatorStyle: theme.dim,
    rowStyle: (text, row) => styleForStatus(theme, row._status)(text),
  });

  return renderPanel({
    title: t(language, 'section.prayerTimes'),
    lines: table,
    width,
    theme,
  });
}

function renderNextPanel({ width, theme, language, config, data }) {
  const contentWidth = width - 4;
  const lines = [];
  const pushCentered = (text, style = (value) => value) => {
    for (const line of wrapDisplay(text, contentWidth)) {
      lines.push(centerDisplay(style(line), contentWidth));
    }
  };

  if (data.next) {
    const name = prayerLabel(language, data.next.name);
    const time = formatShortTime(data.next.time, config.timeFormat, language);
    const tomorrow = data.next.isTomorrow ? ` · ${t(language, 'next.tomorrow')}` : '';

    lines.push('');
    pushCentered(name.toUpperCase(), (line) => theme.emerald(theme.bold(line)));
    pushCentered(`${time}${tomorrow}`, theme.emerald);
    pushCentered(
      `${t(language, 'next.in')} ${formatCountdown(data.countdownMs, language)}`,
      theme.gray,
    );

    if (data.current) {
      const end = data.current.endName
        ? prayerLabel(language, data.current.endName)
        : t(language, 'next.midnight');
      pushCentered(
        `${t(language, 'next.current')}: ${prayerLabel(language, data.current.name)}`
        + ` · ${t(language, 'next.until')} ${end}`,
        theme.cyan,
      );
    }
    lines.push('');
  } else {
    lines.push('');
    const message = data.source === 'none'
      ? t(language, 'next.noData')
      : t(language, 'warning.tomorrow');
    pushCentered(message, theme.gold);
    if (data.current) {
      const end = data.current.endName
        ? prayerLabel(language, data.current.endName)
        : t(language, 'next.midnight');
      pushCentered(
        `${t(language, 'next.current')}: ${prayerLabel(language, data.current.name)}`
        + ` · ${t(language, 'next.until')} ${end}`,
        theme.cyan,
      );
    }
    lines.push('');
  }

  return renderPanel({
    title: t(language, 'section.nextPrayer'),
    lines,
    width,
    theme,
  });
}

function renderStatusPanel({ width, theme, language, config, data }) {
  const sourceKey = data.source === 'fresh'
    ? 'api.fresh'
    : data.source === 'cached' ? 'api.cached' : 'api.unavailable';
  const sourceStyle = data.source === 'fresh'
    ? theme.emerald
    : data.source === 'cached' ? theme.gold : theme.red;

  const rows = [
    {
      key: { text: t(language, 'api.source'), style: theme.gray },
      value: { text: t(language, sourceKey), style: sourceStyle },
    },
    {
      key: { text: t(language, 'api.lastRefresh'), style: theme.gray },
      value: {
        text: data.savedAt
          ? formatDateTime(data.savedAt, language)
          : t(language, 'api.never'),
        style: data.savedAt ? undefined : theme.gray,
      },
    },
    {
      key: { text: t(language, 'api.method'), style: theme.gray },
      value: {
        text: `${localizeNumber(config.method, language)} · ${getMethodShortName(config.method)}`,
      },
    },
    {
      key: { text: t(language, 'api.school'), style: theme.gray },
      value: {
        text: `${getSchoolName(config.school, language)} (${localizeNumber(config.school, language)})`,
      },
    },
    {
      key: { text: t(language, 'api.adjustment'), style: theme.gray },
      value: { text: adjustmentText(config.hijriAdjustment, language) },
    },
  ];

  const table = renderTable({
    columns: [
      { key: 'key', header: '', minWidth: 7, priority: 2 },
      { key: 'value', header: '', minWidth: 7, priority: 1 },
    ],
    rows,
    width: width - 4,
    gap: 2,
    showHeader: false,
    separator: false,
  });

  return renderPanel({
    title: t(language, 'section.status'),
    lines: table,
    width,
    theme,
  });
}

function renderWarnings({ width, theme, language, warnings }) {
  if (!warnings || warnings.length === 0) return [];
  const lines = [''];

  for (const warning of warnings) {
    const style = warningStyle(theme, warning.key);
    const prefix = `${theme.symbols.warning} `;
    const message = warningMessage(language, warning);
    const wrapped = wrapDisplay(message, Math.max(1, width - stringWidth(prefix)));
    wrapped.forEach((line, index) => {
      const marker = index === 0 ? prefix : ' '.repeat(stringWidth(prefix));
      lines.push(`${style(marker)}${style(line)}`);
    });
  }

  return lines;
}

function renderNotes({ width, theme, language, data }) {
  const lines = [''];
  const notes = [];

  if (data.source === 'cached') notes.push({ text: t(language, 'api.cacheNote'), color: theme.gold });
  notes.push({ text: t(language, 'note.moon'), color: theme.gold });
  notes.push({ text: t(language, 'note.events'), color: theme.gray });
  notes.push({ text: t(language, 'note.legend'), color: theme.gray });

  for (const note of notes) {
    const prefix = `${theme.symbols.bullet} `;
    const wrapped = wrapDisplay(note.text, Math.max(1, width - stringWidth(prefix)));
    wrapped.forEach((line, index) => {
      const marker = index === 0 ? prefix : ' '.repeat(stringWidth(prefix));
      lines.push(`${note.color(marker)}${note.color(line)}`);
    });
  }

  return lines;
}

/**
 * Render the complete one-shot dashboard.
 *
 * @param {{
 *   config: object,
 *   data: object,
 *   width?: number,
 *   theme?: object,
 *   color?: boolean,
 *   unicode?: boolean,
 *   version?: string,
 * }} options
 * @returns {string}
 */
export function renderDashboard(options) {
  const config = options.config;
  const data = options.data;
  const language = config.language ?? 'en';
  const width = Math.max(20, Math.floor(options.width ?? resolveTerminalWidth()));
  const theme = options.theme ?? createTheme({ color: options.color, unicode: options.unicode });
  const version = options.version ?? getVersion();
  const now = data.now ?? DateTime.now().setZone(config.timezone);
  const dateInfo = createDateInfo({
    now,
    timezone: config.timezone,
    language,
  });

  const lines = [];
  lines.push(...renderBanner({ width, theme, language }));
  lines.push('');

  const panels = [
    renderInfoPanel({ width, theme, language, config, dateInfo, data }),
    renderPrayerPanel({ width, theme, language, config, data }),
    renderNextPanel({ width, theme, language, config, data }),
    renderStatusPanel({ width, theme, language, config, data }),
  ];

  for (const panel of panels) {
    lines.push(...panel);
    lines.push('');
  }

  lines.push(...renderWarnings({
    width,
    theme,
    language,
    warnings: data.warnings ?? [],
  }));

  lines.push(...renderNotes({ width, theme, language, data }));
  lines.push('');
  lines.push(centerDisplay(
    theme.gray(`${APP_NAME} v${version} ${theme.symbols.dot} AlAdhan API`),
    width,
  ));

  return lines.join('\n');
}
