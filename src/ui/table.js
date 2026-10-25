import { stripAnsi } from './colors.js';

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('en', { granularity: 'grapheme' })
  : null;

function graphemes(text) {
  const value = String(text ?? '');
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(value), (part) => part.segment);
  }
  return Array.from(value);
}

const MARK_PATTERN = /\p{Mark}/u;

function isCombining(codePoint) {
  return MARK_PATTERN.test(String.fromCodePoint(codePoint));
}

function isZeroWidth(codePoint) {
  return (
    codePoint === 0x200b
    || codePoint === 0x200c
    || codePoint === 0x200d
    || codePoint === 0x2060
    || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
    || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

function isFullWidth(codePoint) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f)
    || (codePoint >= 0x2329 && codePoint <= 0x232a)
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
    || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    || (codePoint >= 0x1f300 && codePoint <= 0x1faff)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function graphemeWidth(grapheme) {
  let hasBase = false;
  let wide = false;

  for (const character of grapheme) {
    const codePoint = character.codePointAt(0);
    if (isZeroWidth(codePoint) || isCombining(codePoint)) {
      if (codePoint === 0xfe0f) wide = true;
      continue;
    }
    if (isFullWidth(codePoint)) {
      wide = true;
      hasBase = true;
      continue;
    }
    if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) {
      continue;
    }
    hasBase = true;
  }

  if (wide) return 2;
  return hasBase ? 1 : 0;
}

/**
 * Visible width of a string, ignoring ANSI escapes and combining marks.
 * Intl.Segmenter keeps Bangla conjuncts together, which is important for
 * Termux fonts and for padding table cells correctly.
 *
 * @param {unknown} text
 * @returns {number}
 */
export function stringWidth(text) {
  const plain = stripAnsi(text);
  let maximum = 0;

  for (const line of plain.split('\n')) {
    let width = 0;
    for (const grapheme of graphemes(line)) {
      width += graphemeWidth(grapheme);
    }
    maximum = Math.max(maximum, width);
  }

  return maximum;
}

/**
 * Pad a plain string to a display width. ANSI escape sequences are not counted.
 *
 * @param {unknown} text
 * @param {number} width
 * @param {'left'|'right'|'center'} [align]
 */
export function padDisplay(text, width, align = 'left') {
  const value = String(text ?? '');
  const visible = stringWidth(value);
  if (visible >= width) return visible === width ? value : truncateDisplay(value, width);

  const remaining = width - visible;
  if (align === 'right') return `${' '.repeat(remaining)}${value}`;
  if (align === 'center') {
    const left = Math.floor(remaining / 2);
    return `${' '.repeat(left)}${value}${' '.repeat(remaining - left)}`;
  }
  return `${value}${' '.repeat(remaining)}`;
}

/**
 * Truncate a plain string to a display width, adding an ellipsis when needed.
 * Do not pass colored strings here; the ellipsis may interrupt ANSI state.
 *
 * @param {unknown} text
 * @param {number} width
 * @param {string} [ellipsis]
 */
export function truncateDisplay(text, width, ellipsis = '…') {
  const value = String(text ?? '');
  if (width <= 0) return '';
  if (stringWidth(value) <= width) return value;

  const ellipsisWidth = stringWidth(ellipsis);
  if (ellipsisWidth >= width) return graphemes(ellipsis).slice(0, width).join('');

  let result = '';
  let used = 0;
  for (const grapheme of graphemes(value)) {
    const size = graphemeWidth(grapheme);
    if (used + size > width - ellipsisWidth) break;
    result += grapheme;
    used += size;
  }
  return `${result}${ellipsis}`;
}

/**
 * Wrap plain text to a display width. Words longer than a line are split by
 * grapheme so Bangla text and URLs cannot overflow the terminal.
 *
 * @param {unknown} text
 * @param {number} width
 * @returns {string[]}
 */
export function wrapDisplay(text, width) {
  const value = String(text ?? '');
  if (width <= 0) return [''];
  if (value === '') return [''];

  const output = [];
  const paragraphs = value.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      output.push('');
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    let lineWidth = 0;

    const pushLine = () => {
      output.push(line);
      line = '';
      lineWidth = 0;
    };

    const appendLongWord = (word) => {
      let chunk = '';
      let chunkWidth = 0;
      for (const grapheme of graphemes(word)) {
        const size = graphemeWidth(grapheme);
        if (chunkWidth > 0 && chunkWidth + size > width) {
          if (line) pushLine();
          output.push(chunk);
          chunk = '';
          chunkWidth = 0;
        }
        chunk += grapheme;
        chunkWidth += size;
      }
      if (chunk) {
        if (line) pushLine();
        line = chunk;
        lineWidth = chunkWidth;
      }
    };

    for (const word of words) {
      const wordWidth = stringWidth(word);
      if (wordWidth > width) {
        appendLongWord(word);
        continue;
      }

      if (lineWidth === 0) {
        line = word;
        lineWidth = wordWidth;
      } else if (lineWidth + 1 + wordWidth <= width) {
        line = `${line} ${word}`;
        lineWidth += 1 + wordWidth;
      } else {
        pushLine();
        line = word;
        lineWidth = wordWidth;
      }
    }

    if (lineWidth > 0) pushLine();
  }

  return output.length > 0 ? output : [''];
}

export function centerDisplay(text, width) {
  return padDisplay(text, width, 'center');
}

/**
 * Pick a safe dashboard width from the terminal column count. One column is
 * reserved to avoid the edge-wrap bug common in Termux terminals.
 *
 * @param {number} [columns]
 * @returns {number}
 */
export function resolveTerminalWidth(columns = process.stdout.columns) {
  const numeric = Number(columns);
  if (!Number.isFinite(numeric) || numeric <= 0) return 80;
  return Math.max(20, Math.min(Math.floor(numeric) - 1, 92));
}

function cellContent(cell) {
  if (cell && typeof cell === 'object' && 'text' in cell) {
    return { text: String(cell.text ?? ''), style: cell.style ?? null };
  }
  return { text: String(cell ?? ''), style: null };
}

function cellValue(row, column, index) {
  if (Array.isArray(row)) return row[index];
  return row?.[column.key];
}

/**
 * Render a compact, borderless table that fits within a display width. Columns
 * wrap rather than overflow, and low-priority columns are dropped when the
 * terminal is extremely narrow.
 *
 * @param {{
 *   columns: Array<{key: string, header: string, align?: 'left'|'right'|'center', minWidth?: number, priority?: number, hideBelow?: number}>,
 *   rows: Array<Record<string, unknown>|Array<unknown>>,
 *   width: number,
 *   gap?: number,
 *   headerStyle?: Function|null,
 *   separatorStyle?: Function|null,
 *   rowStyle?: Function|null,
 *   separator?: boolean,
 * }} options
 * @returns {string[]}
 */
export function renderTable(options) {
  const width = Math.max(1, Math.floor(options.width));
  const gap = options.gap ?? 2;
  const columns = (options.columns ?? []).filter(
    (column) => !column.hideBelow || width >= column.hideBelow,
  );
  if (columns.length === 0) return [];

  const normalizedRows = (options.rows ?? []).map((row) => {
    const result = Array.isArray(row) ? {} : { ...row };
    columns.forEach((column, index) => {
      result[column.key] = cellContent(cellValue(row, column, index));
    });
    return result;
  });

  const active = [...columns];
  const minimumTotal = (list) => (
    list.reduce((sum, column) => sum + Math.max(1, column.minWidth ?? 4), 0)
    + gap * Math.max(0, list.length - 1)
  );

  while (active.length > 1 && minimumTotal(active) > width) {
    let dropIndex = 0;
    for (let index = 1; index < active.length; index += 1) {
      const currentPriority = active[index].priority ?? 1;
      const dropPriority = active[dropIndex].priority ?? 1;
      if (currentPriority <= dropPriority) dropIndex = index;
    }
    active.splice(dropIndex, 1);
  }

  const available = Math.max(1, width - gap * (active.length - 1));
  const natural = active.map((column) => {
    const min = Math.max(1, column.minWidth ?? 4);
    const headerWidth = stringWidth(column.header ?? '');
    let widest = headerWidth;
    for (const row of normalizedRows) {
      widest = Math.max(widest, stringWidth(row[column.key].text));
    }
    return Math.max(min, widest);
  });

  const widths = [...natural];
  let total = widths.reduce((sum, value) => sum + value, 0);

  while (total > available) {
    let largestIndex = -1;
    let largestWidth = 0;
    for (let index = 0; index < widths.length; index += 1) {
      const min = Math.max(1, active[index].minWidth ?? 4);
      if (widths[index] > min && widths[index] > largestWidth) {
        largestIndex = index;
        largestWidth = widths[index];
      }
    }
    if (largestIndex === -1) break;
    widths[largestIndex] -= 1;
    total -= 1;
  }

  // A single column with a large minimum width still needs to fit the panel.
  let excess = widths.reduce((sum, value) => sum + value, 0) - available;
  for (let index = widths.length - 1; excess > 0 && index >= 0; index -= 1) {
    const reduction = Math.min(excess, Math.max(0, widths[index] - 1));
    widths[index] -= reduction;
    excess -= reduction;
  }

  const lines = [];
  if (options.showHeader !== false) {
    const headerCells = active.map((column, index) => {
      const text = padDisplay(column.header ?? '', widths[index], column.align ?? 'left');
      return options.headerStyle ? options.headerStyle(text) : text;
    });
    lines.push(headerCells.join(' '.repeat(gap)).trimEnd());

    if (options.separator !== false) {
      const separator = widths
        .map((columnWidth) => '─'.repeat(columnWidth))
        .join(' '.repeat(gap));
      lines.push(options.separatorStyle ? options.separatorStyle(separator) : separator);
    }
  }

  normalizedRows.forEach((row, rowIndex) => {
    const wrapped = active.map((column, index) => (
      wrapDisplay(row[column.key].text, widths[index])
    ));
    const height = Math.max(...wrapped.map((cellLines) => cellLines.length), 1);

    for (let lineIndex = 0; lineIndex < height; lineIndex += 1) {
      const parts = active.map((column, index) => {
        const cell = row[column.key];
        const text = wrapped[index][lineIndex] ?? '';
        const padded = padDisplay(text, widths[index], column.align ?? 'left');
        if (options.rowStyle) return options.rowStyle(padded, row, rowIndex);
        if (cell.style) return cell.style(padded);
        return padded;
      });
      lines.push(parts.join(' '.repeat(gap)).trimEnd());
    }
  });

  return lines;
}

/**
 * Draw a bordered panel around already-wrapped content. Every returned line is
 * exactly `width` cells wide, which keeps the dashboard stable when mixed with
 * Bangla graphemes and ANSI color codes.
 *
 * @param {{title?: string, lines?: string[], width: number, theme: object}} options
 * @returns {string[]}
 */
export function renderPanel(options) {
  const width = Math.max(8, Math.floor(options.width));
  const { theme } = options;
  const symbols = theme.symbols;
  const border = theme.gray;
  const contentWidth = width - 4;
  const output = [];

  if (options.title) {
    const maxLabel = Math.max(1, width - 4);
    const title = truncateDisplay(options.title, maxLabel, theme.symbols.ellipsis);
    const label = ` ${title} `;
    const remaining = Math.max(0, width - 3 - stringWidth(label));
    output.push(
      `${border(symbols.tl)}${border(symbols.h)}${theme.gold(label)}${border(symbols.h.repeat(remaining))}${border(symbols.tr)}`,
    );
  } else {
    output.push(`${border(symbols.tl)}${border(symbols.h.repeat(width - 2))}${border(symbols.tr)}`);
  }

  for (const sourceLine of options.lines ?? []) {
    const pieces = String(sourceLine ?? '').split('\n');
    for (const piece of pieces) {
      let line = piece;
      if (stringWidth(line) > contentWidth) {
        line = truncateDisplay(line, contentWidth, theme.symbols.ellipsis);
      }
      output.push(
        `${border(symbols.v)} ${padDisplay(line, contentWidth)} ${border(symbols.v)}`,
      );
    }
  }

  output.push(`${border(symbols.bl)}${border(symbols.h.repeat(width - 2))}${border(symbols.br)}`);
  return output;
}
