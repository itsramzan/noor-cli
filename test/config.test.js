import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_CONFIG,
  getConfigPath,
  loadConfig,
  normalizeConfig,
  resolveConfigKey,
  saveConfig,
  updateConfig,
} from '../src/config.js';
import { ResponseCache, makeCacheKey } from '../src/cache.js';
import { makeTempDir } from './helpers.js';

test('missing configuration returns the documented defaults', () => {
  const directory = makeTempDir();
  const path = join(directory, 'config.json');
  const loaded = loadConfig({ path });

  assert.equal(loaded.exists, false);
  assert.deepEqual(loaded.config, DEFAULT_CONFIG);
  assert.deepEqual(loaded.warnings, []);
  assert.equal(loaded.path, path);
});

test('configuration paths honor NOOR_CONFIG_PATH', () => {
  const previous = process.env.NOOR_CONFIG_PATH;
  process.env.NOOR_CONFIG_PATH = '/tmp/opencode/custom/noor.json';
  try {
    assert.equal(getConfigPath(), '/tmp/opencode/custom/noor.json');
  } finally {
    if (previous === undefined) delete process.env.NOOR_CONFIG_PATH;
    else process.env.NOOR_CONFIG_PATH = previous;
  }
});

test('saveConfig writes private JSON and updateConfig validates values', () => {
  const directory = makeTempDir();
  const path = join(directory, 'nested', 'config.json');

  const saved = saveConfig({
    ...DEFAULT_CONFIG,
    city: 'Savar',
    method: 2,
    school: 0,
    hijriAdjustment: -1,
  }, { path });

  assert.equal(saved.config.city, 'Savar');
  assert.equal(existsSync(path), true);
  assert.match(readFileSync(path, 'utf8'), /"method": 2/);

  const updated = updateConfig({ format: '24h', adjustment: 1 }, { path });
  assert.equal(updated.config.timeFormat, '24h');
  assert.equal(updated.config.hijriAdjustment, 1);
  assert.equal(updated.config.city, 'Savar');
});

test('malformed configuration is backed up and defaults are used', () => {
  const directory = makeTempDir();
  const path = join(directory, 'config.json');
  writeFileSync(path, '{ this is not json');

  const loaded = loadConfig({ path });
  assert.deepEqual(loaded.config, DEFAULT_CONFIG);
  assert.ok(loaded.warnings.some((warning) => warning.includes('not valid JSON')));
  assert.ok(loaded.warnings.some((warning) => warning.includes('backup')));
  const backups = readFileSync(path, 'utf8');
  assert.equal(backups, '{ this is not json');
});

test('invalid fields fall back to defaults without losing valid settings', () => {
  const directory = makeTempDir();
  const path = join(directory, 'config.json');
  writeFileSync(path, JSON.stringify({
    city: 'Chattogram',
    timezone: 'Not/AZone',
    method: 999,
    language: 'fr',
    unknown: true,
    school: 0,
  }));

  const loaded = loadConfig({ path });
  assert.equal(loaded.config.city, 'Chattogram');
  assert.equal(loaded.config.school, 0);
  assert.equal(loaded.config.timezone, DEFAULT_CONFIG.timezone);
  assert.equal(loaded.config.method, DEFAULT_CONFIG.method);
  assert.equal(loaded.config.language, DEFAULT_CONFIG.language);
  assert.ok(loaded.warnings.length >= 4);
});

test('normalizeConfig accepts numeric strings and aliases resolve', () => {
  const warnings = [];
  const config = normalizeConfig({ method: '3', school: 'hanafi', format: '24h' }, warnings);
  assert.equal(config.method, 3);
  assert.equal(config.school, 1);
  assert.equal(config.timeFormat, '12h');
  assert.ok(warnings.some((warning) => warning.includes('Unknown configuration key "format"')));
  assert.equal(resolveConfigKey('format'), 'timeFormat');
  assert.equal(resolveConfigKey('adjustment'), 'hijriAdjustment');
  assert.equal(resolveConfigKey('nope'), null);
});

test('cache stores entries, reports age, prunes, and survives corruption', () => {
  const directory = makeTempDir();
  const path = join(directory, 'cache.json');
  let now = 1_700_000_000_000;
  const cache = new ResponseCache({
    path,
    now: () => now,
    maxAgeMs: 1000,
    maxEntries: 2,
  });

  const key = makeCacheKey('timings', ['2026-10-25', 'Dhaka', 'Bangladesh']);
  cache.set(key, { value: 1 });
  const entry = cache.get(key);
  assert.equal(entry.value.value, 1);
  assert.equal(entry.ageMs, 0);

  now += 5000;
  assert.equal(cache.get(key).ageMs, 5000);

  const reloaded = new ResponseCache({ path, now: () => now, maxEntries: 2 });
  assert.equal(reloaded.get(key).value.value, 1);

  now += 1_300_000_000;
  reloaded.prune();
  assert.equal(reloaded.get(key), null);

  writeFileSync(path, 'not json');
  const corrupt = new ResponseCache({ path });
  assert.ok(corrupt.warnings.some((warning) => warning.includes('not valid JSON')));
});

test('cache key builder is deterministic', () => {
  assert.equal(
    makeCacheKey('timings', ['2026-10-25', 'New York', 'USA', 'Asia/Dhaka']),
    'timings:2026-10-25:new_york:usa:asia/dhaka',
  );
});
