import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTempDir } from './helpers.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const entry = join(projectRoot, 'src', 'index.js');

function run(args, environment = {}) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      NO_COLOR: '1',
      NOOR_ASCII: '1',
      ...environment,
    },
  });
}

function envFor(directory) {
  return {
    NOOR_CONFIG_PATH: join(directory, 'config.json'),
    NOOR_CACHE_PATH: join(directory, 'cache.json'),
  };
}

test('--version and --help work without touching the network', () => {
  const version = run(['--version']);
  assert.equal(version.status, 0);
  assert.match(version.stdout, /NOOR CLI v\d+\.\d+\.\d+/);

  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /USAGE/);
  assert.match(help.stdout, /noor config <key> \[value\]/);
  assert.match(help.stdout, /--12h \/ --24h/);
});

test('help supports the Bangla display override', () => {
  const directory = makeTempDir();
  const help = run(['--bn', '--help'], envFor(directory));
  assert.equal(help.status, 0);
  assert.match(help.stdout, /ব্যবহার/);
  assert.match(help.stdout, /কনফিগারেশন কী/);
});

test('config view shows documented defaults', () => {
  const directory = makeTempDir();
  const view = run(['config'], envFor(directory));
  assert.equal(view.status, 0);
  assert.match(view.stdout, /CONFIGURATION/);
  assert.match(view.stdout, /Dhaka/);
  assert.match(view.stdout, /Asia\/Dhaka/);
  assert.match(view.stdout, /Karachi/);
  assert.match(view.stdout, /Shafi/);
});

test('config setting validates and persists values', () => {
  const directory = makeTempDir();
  const environment = envFor(directory);

  const set = run(['config', 'city', 'Savar'], environment);
  assert.equal(set.status, 0, set.stderr);
  assert.match(set.stdout, /Savar/);

  const saved = JSON.parse(readFileSync(environment.NOOR_CONFIG_PATH, 'utf8'));
  assert.equal(saved.city, 'Savar');

  const setFormat = run(['config', 'format', '24h'], environment);
  assert.equal(setFormat.status, 0, setFormat.stderr);
  const savedAgain = JSON.parse(readFileSync(environment.NOOR_CONFIG_PATH, 'utf8'));
  assert.equal(savedAgain.timeFormat, '24h');
  assert.equal(savedAgain.city, 'Savar');
});

test('invalid config keys and values exit with code 2', () => {
  const directory = makeTempDir();
  const environment = envFor(directory);

  const key = run(['config', 'nonsense', 'x'], environment);
  assert.equal(key.status, 2);
  assert.match(key.stderr, /Unknown configuration key/);

  const value = run(['config', 'method', '999'], environment);
  assert.equal(value.status, 2);
  assert.match(value.stderr, /Unsupported calculation method/);

  const timezone = run(['config', 'timezone', 'Mars/Olympus'], environment);
  assert.equal(timezone.status, 2);
  assert.match(timezone.stderr, /not a valid IANA timezone/);
});

test('unknown commands fail cleanly', () => {
  const directory = makeTempDir();
  const result = run(['does-not-exist'], envFor(directory));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown command/);
});

test('offline dashboard still renders the local date and no invented times', () => {
  const directory = makeTempDir();
  const result = run([], {
    ...envFor(directory),
    NOOR_API_BASE_URL: 'http://127.0.0.1:1/v1',
    NOOR_TIMEOUT_MS: '1500',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DATE & TIME/);
  assert.match(result.stdout, /UNAVAILABLE/);
  assert.match(result.stdout, /No cached prayer times/);
  assert.doesNotMatch(result.stdout, /04:44/);
});
