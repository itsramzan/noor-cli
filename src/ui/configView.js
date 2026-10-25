import { localizeNumber } from '../utils/numbers.js';
import { PRAYER_METHODS } from '../utils/constants.js';
import { getMethodShortName, getSchoolName } from '../services/prayerService.js';
import { createTheme } from './colors.js';
import { t } from './i18n.js';
import {
  renderPanel,
  renderTable,
  resolveTerminalWidth,
  stringWidth,
  wrapDisplay,
} from './table.js';

function languageName(language) {
  return language === 'bn' ? 'বাংলা (bn)' : 'English (en)';
}

function formatLabel(format) {
  return format === '24h' ? '24h' : '12h';
}

/**
 * @param {{config: object, path: string, language?: 'en'|'bn', width?: number, theme?: object, showMethods?: boolean}} options
 */
export function renderConfigView(options) {
  const config = options.config;
  const language = options.language ?? config.language ?? 'en';
  const width = Math.max(24, Math.floor(options.width ?? resolveTerminalWidth()));
  const theme = options.theme ?? createTheme();
  const contentWidth = width - 4;
  const lines = [];

  const rows = [
    {
      key: { text: t(language, 'info.city'), style: theme.gray },
      value: { text: config.city },
    },
    {
      key: { text: t(language, 'config.country'), style: theme.gray },
      value: { text: config.country },
    },
    {
      key: { text: t(language, 'info.timezone'), style: theme.gray },
      value: { text: config.timezone },
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
      key: { text: t(language, 'config.language'), style: theme.gray },
      value: { text: languageName(config.language) },
    },
    {
      key: { text: t(language, 'config.format'), style: theme.gray },
      value: { text: formatLabel(config.timeFormat) },
    },
    {
      key: { text: t(language, 'config.adjustment'), style: theme.gray },
      value: {
        text: config.hijriAdjustment === 0
          ? t(language, 'api.noAdjustment')
          : `${config.hijriAdjustment > 0 ? '+' : '-'}${localizeNumber(Math.abs(config.hijriAdjustment), language)}`,
      },
    },
  ];

  lines.push(...renderPanel({
    title: t(language, 'config.title'),
    lines: renderTable({
      columns: [
        { key: 'key', header: '', minWidth: 7, priority: 2 },
        { key: 'value', header: '', minWidth: 8, priority: 1 },
      ],
      rows,
      width: contentWidth,
      gap: 2,
      showHeader: false,
      separator: false,
    }),
    width,
    theme,
  }));

  lines.push('');
  const pathLines = wrapDisplay(`${t(language, 'config.path')}: ${options.path}`, contentWidth);
  lines.push(...renderPanel({ lines: pathLines, width, theme }));

  lines.push('');
  const optionsLines = wrapDisplay(t(language, 'config.optionsText'), contentWidth);
  const methodLines = wrapDisplay(t(language, 'config.methodsText'), contentWidth);
  lines.push(...renderPanel({
    title: t(language, 'config.available'),
    lines: [...optionsLines, '', ...methodLines],
    width,
    theme,
  }));

  lines.push('');
  const commandLines = wrapDisplay(
    t(language, 'config.commands'),
    contentWidth,
  );
  const examples = [
    'noor config city Dhaka',
    'noor config timezone Asia/Dhaka',
    'noor config method 1',
    'noor config school 0',
    'noor config language bn',
    'noor config format 24h',
    'noor config adjustment 0',
    'noor config',
  ];
  const commands = [
    ...commandLines,
    '',
    ...examples.flatMap((example) => wrapDisplay(example, contentWidth)),
  ];
  lines.push(...renderPanel({ lines: commands, width, theme }));

  if (options.showMethods) {
    lines.push('');
    const methodRows = PRAYER_METHODS.map((method) => ({
      id: { text: localizeNumber(method.id, language), style: theme.cyan },
      name: { text: `${method.shortName} — ${method.name}` },
    }));
    lines.push(...renderPanel({
      title: t(language, 'config.available'),
      lines: renderTable({
        columns: [
          { key: 'id', header: t(language, 'config.methodId'), minWidth: 3, priority: 2 },
          { key: 'name', header: t(language, 'config.methodName'), minWidth: 10, priority: 1 },
        ],
        rows: methodRows,
        width: contentWidth,
        gap: 2,
        headerStyle: (text) => theme.gray(theme.bold(text)),
        separatorStyle: theme.dim,
      }),
      width,
      theme,
    }));
  }

  return lines.join('\n');
}

/**
 * Wrap a short line of feedback so it never exceeds the terminal width.
 *
 * @param {string} message
 * @param {{width?: number, theme?: object}} [options]
 */
export function renderMessage(message, options = {}) {
  const width = Math.max(20, Math.floor(options.width ?? resolveTerminalWidth()));
  const theme = options.theme ?? createTheme();
  return wrapDisplay(message, width)
    .map((line) => (stringWidth(line) > width ? line.slice(0, width) : line))
    .join('\n');
}
