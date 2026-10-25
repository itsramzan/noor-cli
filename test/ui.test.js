import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ResponseCache } from '../src/cache.js';
import { createPrayerService } from '../src/services/prayerService.js';
import { createTheme, stripAnsi } from '../src/ui/colors.js';
import { renderDashboard } from '../src/ui/dashboard.js';
import { renderConfigView } from '../src/ui/configView.js';
import {
  padDisplay,
  renderPanel,
  renderTable,
  stringWidth,
  truncateDisplay,
  wrapDisplay,
} from '../src/ui/table.js';
import {
  atLocal,
  baseConfig,
  makeTempDir,
  normalizedTimings,
} from './helpers.js';

function assertFits(text, width) {
  for (const line of text.split('\n')) {
    assert.ok(
      stringWidth(line) <= width,
      `line exceeds ${width} cells (${stringWidth(line)}): ${JSON.stringify(line)}`,
    );
  }
}

async function dashboardData({ now = '2026-10-25T17:04:00', language = 'en', timeFormat = '12h' } = {}) {
  const directory = makeTempDir();
  const cache = new ResponseCache({ path: join(directory, 'cache.json') });
  const service = createPrayerService({
    client: {
      async timingsByCity() {
        return normalizedTimings();
      },
    },
    cache,
    now: () => atLocal(now),
  });

  return service.getDashboardData({
    config: baseConfig({ language, timeFormat }),
  });
}

test('stringWidth ignores ANSI, combining marks, and Bangla conjuncts', () => {
  assert.equal(stringWidth('\u001b[31mhello\u001b[0m'), 5);
  assert.equal(stringWidth('৯ কার্তিক ১৪৩৩'), 10);
  assert.equal(stringWidth('ক্ষ'), 1);
  assert.equal(stringWidth('ইসলাম'), 4);
  assert.equal(stringWidth(''), 0);
});

test('padding, wrapping, and truncation stay within width', () => {
  assert.equal(padDisplay('Dhaka', 8), 'Dhaka   ');
  assert.equal(padDisplay('Dhaka', 8, 'right'), '   Dhaka');
  assert.equal(padDisplay('Dhaka', 8, 'center'), ' Dhaka  ');
  assert.equal(truncateDisplay('abcdefghij', 5), 'abcd…');
  assert.equal(truncateDisplay('৯ কার্তিক ১৪৩৩', 8).length > 0, true);

  const wrapped = wrapDisplay('one two three four five', 9);
  assert.deepEqual(wrapped, ['one two', 'three', 'four five']);
  for (const line of wrapped) assert.ok(stringWidth(line) <= 9);

  const long = wrapDisplay('সুপ্রভাত', 3);
  assert.ok(long.length >= 2);
  for (const line of long) assert.ok(stringWidth(line) <= 3);
});

test('table rendering is ANSI-aware and narrow-responsive', () => {
  const theme = createTheme({ color: true, unicode: true });
  const lines = renderTable({
    columns: [
      { key: 'name', header: 'Prayer', minWidth: 5, priority: 3 },
      { key: 'time', header: 'Time', minWidth: 5, priority: 2 },
      { key: 'status', header: 'Status', minWidth: 5, priority: 1 },
    ],
    rows: [
      { name: 'Fajr', time: '04:44 AM', status: 'Passed' },
      { name: 'Maghrib', time: '05:24 PM', status: 'Next' },
    ],
    width: 30,
    rowStyle: (text, row) => (row.status.text === 'Next' ? theme.emerald(text) : text),
  });

  for (const line of lines) assert.ok(stringWidth(line) <= 30);
  assert.ok(lines.some((line) => line.includes('\u001b[38;2;0;200;150m')));
});

test('panel borders are exactly the requested width even with color', () => {
  const theme = createTheme({ color: true, unicode: true });
  const lines = renderPanel({
    title: 'DATE & TIME',
    lines: ['Local time   05:24 PM', ''],
    width: 40,
    theme,
  });

  for (const line of lines) {
    assert.equal(stringWidth(line), 40);
  }
});

test('English dashboard renders cleanly at 40 and 80 columns', async () => {
  const data = await dashboardData();
  const config = baseConfig();

  for (const width of [40, 80]) {
    const output = renderDashboard({
      config,
      data,
      width,
      color: true,
      unicode: true,
      version: '1.0.0',
    });

    assertFits(output, width);
    assert.match(output, /PRAYER TIMES/);
    assert.match(output, /MAGHRIB/);
    const plain = stripAnsi(output);
    assert.match(plain, /9 Kartik 1433/);
    // The Hijri value wraps onto a second line at 40 columns, leaving a
    // panel border between the two fragments.
    assert.match(plain, /14 Jumada al-Awwal[\s│]*1448/);
    assert.match(output, /FIRST|FRESH/);
    assert.ok(output.includes('\u001b[38;2;0;200;150m'), 'next prayer should be emerald');
    assert.ok(output.includes('\u001b[38;2;212;175;55m'), 'Hijri date should be gold');
  }
});

test('Bangla dashboard preserves graphemes and width at 40 columns', async () => {
  const data = await dashboardData({ language: 'bn', timeFormat: '24h' });
  const config = baseConfig({ language: 'bn', timeFormat: '24h' });
  const output = renderDashboard({
    config,
    data,
    width: 40,
    color: true,
    unicode: true,
    version: '1.0.0',
  });

  assertFits(output, 40);
  assert.match(output, /তারিখ ও সময়/);
  assert.match(output, /মাগরিব/);
  assert.match(output, /১৭:২৪/);
  assert.match(output, /১৪ জমাদিউল আউয়াল ১৪৪৮/);
});

test('offline dashboard shows unavailable values without fabricated times', async () => {
  const directory = makeTempDir();
  const cache = new ResponseCache({ path: join(directory, 'cache.json') });
  const service = createPrayerService({
    client: {
      async timingsByCity() {
        const error = new Error('offline');
        error.reason = 'network';
        throw error;
      },
    },
    cache,
    now: () => atLocal('2026-10-25T17:04:00'),
  });

  const config = baseConfig();
  const data = await service.getDashboardData({ config });
  const output = renderDashboard({
    config,
    data,
    width: 48,
    color: false,
    unicode: true,
    version: '1.0.0',
  });

  assertFits(output, 48);
  assert.match(output, /UNAVAILABLE/);
  assert.match(output, /No cached prayer times/);
  assert.match(output, /Sunrise\s+—\s+Unavailable/);
  assert.doesNotMatch(output, /04:44/);
});

test('config view wraps long paths and stays inside 40 columns', () => {
  const theme = createTheme({ color: true, unicode: true });
  const output = renderConfigView({
    config: baseConfig({ language: 'bn' }),
    path: '/home/a-very-long-user-name/.config/noor-cli/config.json',
    language: 'bn',
    width: 40,
    theme,
    showMethods: true,
  });

  assertFits(output, 40);
  assert.match(output, /কনফিগারেশন/);
  assert.match(output, /Karachi/);
});
