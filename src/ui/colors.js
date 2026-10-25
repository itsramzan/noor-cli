import chalk, { Chalk } from 'chalk';
import gradientString from 'gradient-string';

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export function stripAnsi(text) {
  return String(text ?? '').replace(ANSI_PATTERN, '');
}

export function supportsColor(stream = process.stdout) {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) {
    return process.env.FORCE_COLOR !== '0';
  }
  if (process.env.TERM === 'dumb') return false;
  return Boolean(stream?.isTTY) && chalk.level > 0;
}

export function supportsUnicode(stream = process.stdout) {
  if (process.env.NOOR_ASCII === '1') return false;
  if (process.env.TERM === 'dumb') return false;

  const locale = String(
    process.env.LC_ALL
    ?? process.env.LC_CTYPE
    ?? process.env.LANG
    ?? '',
  ).toLowerCase();

  if (locale.includes('utf-8') || locale.includes('utf8')) return true;
  if (process.platform === 'win32') return true;
  if (stream?.isTTY) return true;
  return true;
}

const UNICODE_SYMBOLS = Object.freeze({
  tl: '╭',
  tr: '╮',
  bl: '╰',
  br: '╯',
  h: '─',
  v: '│',
  dot: '·',
  bullet: '•',
  warning: '⚠',
  arrow: '→',
  check: '✓',
  ellipsis: '…',
});

const ASCII_SYMBOLS = Object.freeze({
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  h: '-',
  v: '|',
  dot: '.',
  bullet: '*',
  warning: '!',
  arrow: '->',
  check: 'ok',
  ellipsis: '...',
});

/**
 * Build the colors and border glyphs used by the UI. Passing color: true/false
 * bypasses terminal detection, which keeps rendering tests deterministic.
 *
 * @param {{color?: boolean, unicode?: boolean, stream?: NodeJS.WriteStream}} [options]
 */
export function createTheme(options = {}) {
  const colorEnabled = options.color ?? supportsColor(options.stream);
  const unicodeEnabled = options.unicode ?? supportsUnicode(options.stream);
  const activeChalk = colorEnabled
    ? new Chalk({ level: 3 })
    : new Chalk({ level: 0 });

  const hex = (value) => (text) => activeChalk.hex(value)(String(text));
  const style = (fn) => (text) => (colorEnabled ? fn(String(text)) : String(text));
  const gradient = colorEnabled
    ? gradientString(['#00c896', '#38bdf8', '#d4af37'])
    : (text) => String(text);

  return {
    color: colorEnabled,
    unicode: unicodeEnabled,
    symbols: unicodeEnabled ? UNICODE_SYMBOLS : ASCII_SYMBOLS,
    gradient,
    emerald: hex('#00c896'),
    gold: hex('#d4af37'),
    cyan: hex('#38bdf8'),
    red: hex('#f87171'),
    gray: hex('#94a3b8'),
    white: hex('#e2e8f0'),
    bold: style(activeChalk.bold),
    dim: style(activeChalk.dim),
    italic: style(activeChalk.italic),
    underline: style(activeChalk.underline),
    inverse: style(activeChalk.inverse),
    chalk: activeChalk,
  };
}

export { ANSI_PATTERN };
