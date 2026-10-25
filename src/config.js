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
import { DateTime } from 'luxon';
import {
  CONFIG_KEYS,
  CONFIG_KEY_ALIASES,
  DEFAULT_CONFIG,
} from './utils/constants.js';
import {
  assertPlainObject,
  validateConfigValue,
  ValidationError,
} from './utils/validation.js';

/**
 * Resolve the configuration path without touching the file system.
 * NOOR_CONFIG_PATH is intentionally supported for tests and advanced users.
 *
 * @returns {string}
 */
export function getConfigPath() {
  if (process.env.NOOR_CONFIG_PATH) {
    return resolve(process.env.NOOR_CONFIG_PATH);
  }

  const configHome = process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME)
    : join(homedir(), '.config');

  return join(configHome, 'noor-cli', 'config.json');
}

export function resolveConfigKey(key) {
  if (CONFIG_KEYS.includes(key)) return key;
  const alias = CONFIG_KEY_ALIASES[key];
  return alias && CONFIG_KEYS.includes(alias) ? alias : null;
}

function timestampSuffix(now = DateTime.now()) {
  return now.toFormat('yyyyLLdd-HHmmss');
}

function backupInvalidFile(path, warningSink) {
  const backupPath = `${path}.invalid-${timestampSuffix()}`;
  try {
    copyFileSync(path, backupPath);
    warningSink.push(
      `The configuration file was not valid JSON. A backup was saved to ${backupPath}.`,
    );
  } catch {
    warningSink.push(
      'The configuration file was not valid JSON and could not be backed up.',
    );
  }
  return backupPath;
}

/**
 * Merge a partial object into the defaults, validating each known field.
 * Invalid values are reported and replaced with defaults instead of crashing
 * the whole CLI (for example after a hand-edited configuration file).
 *
 * @param {unknown} input
 * @param {string[]} [warnings]
 * @returns {typeof DEFAULT_CONFIG}
 */
export function normalizeConfig(input, warnings = []) {
  assertPlainObject(input, 'Configuration');
  const config = { ...DEFAULT_CONFIG };

  for (const key of Object.keys(input)) {
    if (!CONFIG_KEYS.includes(key)) {
      warnings.push(`Unknown configuration key "${key}" was ignored.`);
    }
  }

  for (const key of CONFIG_KEYS) {
    if (input[key] === undefined) continue;
    try {
      config[key] = validateConfigValue(key, input[key]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Invalid ${key}: ${message} Using the default value instead.`);
      config[key] = DEFAULT_CONFIG[key];
    }
  }

  return config;
}

/**
 * Load configuration from disk. A missing file is normal and returns defaults.
 *
 * @param {{path?: string}} [options]
 * @returns {{config: typeof DEFAULT_CONFIG, path: string, exists: boolean, warnings: string[]}}
 */
export function loadConfig(options = {}) {
  const path = options.path ?? getConfigPath();
  const warnings = [];

  if (!existsSync(path)) {
    return {
      config: { ...DEFAULT_CONFIG },
      path,
      exists: false,
      warnings,
    };
  }

  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    warnings.push(
      `The configuration file could not be read (${error.code ?? 'unknown error'}). Using defaults.`,
    );
    return {
      config: { ...DEFAULT_CONFIG },
      path,
      exists: true,
      warnings,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    backupInvalidFile(path, warnings);
    return {
      config: { ...DEFAULT_CONFIG },
      path,
      exists: true,
      warnings,
    };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    backupInvalidFile(path, warnings);
    warnings.push('The configuration file must contain a JSON object. Using defaults.');
    return {
      config: { ...DEFAULT_CONFIG },
      path,
      exists: true,
      warnings,
    };
  }

  let config;
  try {
    config = normalizeConfig(parsed, warnings);
  } catch (error) {
    warnings.push(
      `${error instanceof Error ? error.message : String(error)} Using defaults.`,
    );
    config = { ...DEFAULT_CONFIG };
  }

  return { config, path, exists: true, warnings };
}

/**
 * Validate and atomically write a complete configuration object.
 * The configuration contains only personal preferences, but keeping it private
 * (0600) is a sensible default on shared devices.
 *
 * @param {Partial<typeof DEFAULT_CONFIG>} input
 * @param {{path?: string, warnings?: string[]}} [options]
 * @returns {{config: typeof DEFAULT_CONFIG, path: string}}
 */
export function saveConfig(input, options = {}) {
  const path = options.path ?? getConfigPath();
  const warnings = options.warnings ?? [];
  const config = normalizeConfig({ ...DEFAULT_CONFIG, ...input }, warnings);
  const directory = dirname(path);
  const temporaryPath = join(
    directory,
    `.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
  );

  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, path);
    chmodSync(path, 0o600);
  } catch (error) {
    try {
      rmSync(temporaryPath, { force: true });
    } catch {
      // Best effort cleanup only.
    }
    throw new Error(`Could not save configuration to ${path}: ${error.message}`, {
      cause: error,
    });
  }

  return { config, path };
}

/**
 * Load, modify, validate, and save configuration in one step.
 *
 * @param {Record<string, unknown>} patch
 * @param {{path?: string}} [options]
 * @returns {{config: typeof DEFAULT_CONFIG, previous: typeof DEFAULT_CONFIG, path: string, warnings: string[]}}
 */
export function updateConfig(patch, options = {}) {
  const loaded = loadConfig(options);
  const nextInput = { ...loaded.config };

  for (const [rawKey, value] of Object.entries(patch)) {
    const key = resolveConfigKey(rawKey);
    if (!key) {
      throw new ValidationError(`Unknown configuration key "${rawKey}".`, rawKey);
    }
    nextInput[key] = validateConfigValue(key, value);
  }

  const saved = saveConfig(nextInput, { path: loaded.path });
  return {
    config: saved.config,
    previous: loaded.config,
    path: saved.path,
    warnings: loaded.warnings,
  };
}

export function configFileExists(path = getConfigPath()) {
  return existsSync(path);
}

export { CONFIG_KEYS, CONFIG_KEY_ALIASES, DEFAULT_CONFIG };
