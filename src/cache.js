import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const CACHE_VERSION = 1;
const DEFAULT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 32;

export function getCachePath() {
  if (process.env.NOOR_CACHE_PATH) {
    return resolve(process.env.NOOR_CACHE_PATH);
  }

  const cacheHome = process.env.XDG_CACHE_HOME
    ? resolve(process.env.XDG_CACHE_HOME)
    : join(homedir(), '.cache');

  return join(cacheHome, 'noor-cli', 'cache.json');
}

function toMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function backupInvalidCache(path) {
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${path}.invalid-${suffix}`;
  try {
    copyFileSync(path, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

/**
 * A small JSON response cache with atomic writes. Cache failures are never
 * fatal: the dashboard can still work online without a writable cache.
 */
export class ResponseCache {
  constructor(options = {}) {
    this.path = options.path ?? getCachePath();
    this.maxAgeMs = options.maxAgeMs ?? 15 * 60 * 1000;
    this.retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? (() => Date.now());
    this.warnings = [];
    this.entries = {};
    this._load();
  }

  _load() {
    if (!existsSync(this.path)) return;

    let text;
    try {
      text = readFileSync(this.path, 'utf8');
    } catch {
      this.warnings.push('The response cache could not be read and was ignored.');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const backup = backupInvalidCache(this.path);
      this.warnings.push(
        backup
          ? `The response cache was not valid JSON. A backup was saved to ${backup}.`
          : 'The response cache was not valid JSON and was ignored.',
      );
      return;
    }

    if (
      parsed === null
      || typeof parsed !== 'object'
      || Array.isArray(parsed)
      || parsed.entries === null
      || typeof parsed.entries !== 'object'
      || Array.isArray(parsed.entries)
    ) {
      this.warnings.push('The response cache had an unsupported shape and was ignored.');
      return;
    }

    for (const [key, entry] of Object.entries(parsed.entries)) {
      if (
        entry
        && typeof entry === 'object'
        && entry.value !== undefined
        && Number.isFinite(toMillis(entry.savedAt))
        && toMillis(entry.savedAt) > 0
      ) {
        this.entries[key] = entry;
      }
    }

    this.prune();
  }

  /**
   * Return a cached entry regardless of age. The caller decides whether the
   * entry is fresh enough for a non-forced read.
   *
   * @param {string} key
   * @returns {{value: unknown, savedAt: string, savedAtMs: number, ageMs: number, meta: object}|null}
   */
  get(key) {
    const entry = this.entries[key];
    if (!entry) return null;

    const savedAtMs = toMillis(entry.savedAt);
    if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return null;

    return {
      ...entry,
      savedAtMs,
      ageMs: Math.max(0, this._nowMs() - savedAtMs),
    };
  }

  set(key, value, meta = {}) {
    const nowMs = this._nowMs();
    const entry = {
      savedAt: new Date(nowMs).toISOString(),
      value,
      meta,
    };
    this.entries[key] = entry;
    this.prune();
    this._write();
    return {
      ...entry,
      savedAtMs: nowMs,
      ageMs: 0,
    };
  }

  delete(key) {
    if (!(key in this.entries)) return false;
    delete this.entries[key];
    this._write();
    return true;
  }

  clear() {
    this.entries = {};
    this._write();
  }

  prune() {
    const nowMs = this._nowMs();
    const sorted = [];

    for (const [key, entry] of Object.entries(this.entries)) {
      const savedAtMs = toMillis(entry.savedAt);
      if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) {
        delete this.entries[key];
        continue;
      }
      if (nowMs - savedAtMs > this.retentionMs) {
        delete this.entries[key];
        continue;
      }
      sorted.push([key, savedAtMs]);
    }

    if (sorted.length > this.maxEntries) {
      sorted.sort((a, b) => b[1] - a[1]);
      for (const [key] of sorted.slice(this.maxEntries)) {
        delete this.entries[key];
      }
    }
  }

  _write() {
    const directory = dirname(this.path);
    const temporaryPath = join(
      directory,
      `.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
    );

    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      writeFileSync(
        temporaryPath,
        `${JSON.stringify({ version: CACHE_VERSION, entries: this.entries }, null, 2)}\n`,
        { encoding: 'utf8', mode: 0o600 },
      );
      chmodSync(temporaryPath, 0o600);
      renameSync(temporaryPath, this.path);
      chmodSync(this.path, 0o600);
    } catch {
      try {
        rmSync(temporaryPath, { force: true });
      } catch {
        // Best effort cleanup only.
      }
      this.warnings.push('The response cache could not be saved. Continuing without it.');
    }
  }

  _nowMs() {
    const value = this.now();
    return value instanceof Date ? value.getTime() : Number(value);
  }
}

/**
 * Build a deterministic cache key from values. Configuration values with
 * spaces are normalized while keeping the result readable when inspecting the
 * cache by hand.
 *
 * @param {string} namespace
 * @param {Array<string|number>} parts
 * @returns {string}
 */
export function makeCacheKey(namespace, parts) {
  const normalized = parts.map((part) => String(part).trim().toLowerCase().replace(/\s+/g, '_'));
  return `${namespace}:${normalized.join(':')}`;
}
