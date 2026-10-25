import figlet from 'figlet';
import { t } from './i18n.js';
import { centerDisplay, stringWidth, wrapDisplay } from './table.js';

function figletLines(font) {
  try {
    return figlet
      .textSync('NOOR', { font, horizontalLayout: 'fitted' })
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== '');
  } catch {
    return [];
  }
}

/**
 * Render the NOOR wordmark. The layout automatically shrinks on narrow Termux
 * terminals and falls back to plain text when a glyph font cannot fit.
 *
 * @param {{width: number, theme: object, language: 'en'|'bn'}} options
 * @returns {string[]}
 */
export function renderBanner(options) {
  const { width, theme, language } = options;
  const lines = [];

  const fontCandidates = width >= 56
    ? ['Standard', 'Small']
    : ['Small'];
  let banner = [];

  for (const font of fontCandidates) {
    const candidate = figletLines(font);
    if (candidate.length > 0 && candidate.every((line) => stringWidth(line) <= width - 2)) {
      banner = candidate;
      break;
    }
  }

  if (banner.length > 0) {
    for (const line of banner) {
      lines.push(centerDisplay(theme.gradient(line), width));
    }
  } else {
    lines.push(centerDisplay(theme.emerald(theme.bold('NOOR')), width));
    lines.push(centerDisplay(theme.gold('────────'), width));
  }

  const tagline = language === 'bn'
    ? t(language, 'banner.banglaTagline')
    : t(language, 'banner.tagline');
  for (const line of wrapDisplay(tagline, Math.max(1, width - 2))) {
    lines.push(centerDisplay(theme.gold(line), width));
  }

  const greeting = language === 'bn'
    ? `${t(language, 'banner.greeting')} · ${t(language, 'banner.banglaGreeting')}`
    : `${t(language, 'banner.greeting')} · ${t(language, 'banner.banglaGreeting')}`;
  for (const line of wrapDisplay(greeting, Math.max(1, width - 2))) {
    lines.push(centerDisplay(theme.gray(line), width));
  }

  return lines;
}
