import { createInterface } from 'node:readline/promises';
import { DateTime } from 'luxon';
import { loadConfig, resolveConfigKey, saveConfig, getConfigPath } from './config.js';
import { ResponseCache, getCachePath } from './cache.js';
import { createAlAdhanClient, DEFAULT_TIMEOUT_MS } from './api/aladhan.js';
import { createPrayerService } from './services/prayerService.js';
import {
  CONFIG_KEYS,
  DEFAULT_CONFIG,
  PRAYER_METHODS,
  SCHOOLS,
} from './utils/constants.js';
import {
  validateConfigValue,
  ValidationError,
} from './utils/validation.js';
import { getVersion } from './utils/version.js';
import { formatBanglaDate } from './services/banglaCalendar.js';
import { createTheme } from './ui/colors.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderConfigView } from './ui/configView.js';
import { t } from './ui/i18n.js';
import {
  resolveTerminalWidth,
  stringWidth,
  wrapDisplay,
} from './ui/table.js';

export class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function parseArguments(argv) {
  const overrides = {};
  const positionals = [];
  let help = false;
  let version = false;
  let passthrough = false;

  for (const argument of argv) {
    if (passthrough) {
      positionals.push(argument);
      continue;
    }

    switch (argument) {
      case '--':
        passthrough = true;
        break;
      case '--bn':
        overrides.language = 'bn';
        break;
      case '--en':
        overrides.language = 'en';
        break;
      case '--12h':
        overrides.timeFormat = '12h';
        break;
      case '--24h':
        overrides.timeFormat = '24h';
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      case '--version':
      case '-v':
        version = true;
        break;
      default:
        if (argument.startsWith('--')) {
          throw new CliError(`Unknown option "${argument}". Run "noor --help" for usage.`);
        }
        positionals.push(argument);
        break;
    }
  }

  return { overrides, positionals, help, version };
}

function buildHelp(language, width, theme) {
  const version = getVersion();
  const en = language === 'en';
  const output = [];
  const blank = () => output.push('');
  const heading = (text) => {
    output.push(theme.gold(theme.bold(text)));
  };
  const paragraph = (text, prefix = '', color = theme.white) => {
    const indent = prefix ? prefix : '';
    for (const line of wrapDisplay(text, Math.max(1, width - stringWidth(indent)))) {
      output.push(`${indent}${color(line)}`);
    }
  };
  const item = (command, description) => {
    const commandWidth = 32;
    const text = `  ${command.padEnd(commandWidth)} ${description}`;
    if (stringWidth(text) <= width) {
      const commandPart = `  ${command.padEnd(commandWidth)} `;
      output.push(`${theme.cyan(commandPart)}${theme.white(description)}`);
      return;
    }
    paragraph(command, '  ', theme.cyan);
    paragraph(description, '    ', theme.gray);
  };

  output.push(theme.gradient('NOOR CLI'));
  output.push(theme.gold(en ? 'Where Time Meets Tranquility' : 'সময়ের মিলনে প্রশান্তি'));
  output.push(theme.gray(`v${version}`));
  blank();

  heading(en ? 'USAGE' : 'ব্যবহার');
  item('noor', en ? 'Show the dashboard (one-shot)' : 'ড্যাশবোর্ড দেখান (একবার)');
  item('noor refresh', en ? 'Force a live API refresh' : 'সরাসরি API রিফ্রেশ করুন');
  item('noor config', en ? 'View or interactively edit settings' : 'সেটিংস দেখুন বা পরিবর্তন করুন');
  item('noor config <key> [value]', en ? 'Read or update one setting' : 'একটি সেটিং পড়ুন বা বদলান');
  item('noor --help', en ? 'Show this help' : 'এই সাহায্য দেখান');
  item('noor --version', en ? 'Show the version' : 'সংস্করণ দেখান');
  blank();

  heading(en ? 'DISPLAY OPTIONS' : 'প্রদর্শন অপশন');
  item('--bn / --en', en ? 'Bangla or English (this run only)' : 'বাংলা বা ইংরেজি (শুধু এই চালানোর জন্য)');
  item('--12h / --24h', en ? 'Clock format (this run only)' : 'ঘড়ির ফরম্যাট (শুধু এই চালানোর জন্য)');
  blank();

  heading(en ? 'CONFIGURATION KEYS' : 'কনফিগারেশন কী');
  paragraph(`city, country, timezone, method, school, language, format, adjustment`, '', theme.white);
  blank();
  heading(en ? 'EXAMPLES' : 'উদাহরণ');
  item('noor config city Savar', en ? 'Change the city' : 'শহর পরিবর্তন');
  item('noor config school 0', en ? 'Set the Asr school (Shafi: 0, Hanafi: 1)' : 'আসর মাযহাব সেট করুন (শাফি: ০, হানাফি: ১)');
  item('noor config timezone Asia/Dhaka', en ? 'Set an IANA timezone' : 'IANA টাইমজোন সেট করুন');
  item('noor config language bn', en ? 'Save Bangla as the default' : 'বাংলা ডিফল্ট হিসেবে সংরক্ষণ');
  item('noor --bn --24h', en ? 'Override display for one run' : 'একবারের জন্য প্রদর্শন বদলান');
  blank();

  heading(en ? 'CONFIG & CACHE' : 'কনফিগ ও ক্যাশ');
  paragraph(`${getConfigPath()}`, '  ', theme.gray);
  paragraph(`${getCachePath()}`, '  ', theme.gray);
  blank();

  heading(en ? 'ABOUT' : 'পরিচিতি');
  paragraph(
    en
      ? 'Prayer times and Hijri dates come from the AlAdhan API. Hijri dates may differ by one day because of local moon sighting. Sunrise and Sunset are informational, not obligatory prayers.'
      : 'নামাজের সময় ও হিজরি তারিখ AlAdhan API থেকে আসে। স্থানীয় চাঁদ দেখার কারণে হিজরি তারিখে এক দিনের পার্থক্য হতে পারে। সূর্যোদয় ও সূর্যাস্ত তথ্যপূর্ণ, ফরজ নামাজ নয়।',
    '',
    theme.gray,
  );

  return output.join('\n');
}

function printWarnings(warnings, io, theme) {
  for (const warning of warnings) {
    for (const line of wrapDisplay(`${theme.symbols.warning} ${warning}`, resolveTerminalWidth(io.columns))) {
      io.stderr.write(`${theme.gold(line)}\n`);
    }
  }
}

function effectiveConfig(config, overrides) {
  return {
    ...config,
    ...(overrides.language ? { language: overrides.language } : {}),
    ...(overrides.timeFormat ? { timeFormat: overrides.timeFormat } : {}),
  };
}

function configLabel(key, config, language) {
  const labels = {
    city: t(language, 'config.prompt.city'),
    country: t(language, 'config.prompt.country'),
    timezone: t(language, 'config.prompt.timezone'),
    method: t(language, 'config.prompt.method'),
    school: t(language, 'config.prompt.school'),
    language: t(language, 'config.prompt.language'),
    timeFormat: t(language, 'config.prompt.format'),
    hijriAdjustment: t(language, 'config.prompt.adjustment'),
  };
  return labels[key] ?? key;
}

function configValueLabel(key, config, language) {
  if (key === 'language') {
    return config.language === 'bn' ? 'বাংলা (bn)' : 'English (en)';
  }
  if (key === 'school') {
    const school = SCHOOLS.find((item) => item.value === config.school);
    return `${school?.name ?? config.school} (${config.school})`;
  }
  if (key === 'method') {
    const method = PRAYER_METHODS.find((item) => item.id === config.method);
    return `${method?.shortName ?? config.method} (${config.method})`;
  }
  if (key === 'hijriAdjustment') {
    return config.hijriAdjustment === 0 ? '0' : String(config.hijriAdjustment);
  }
  return String(config[key]);
}

function promptHint(key, language) {
  if (key === 'school') return t(language, 'config.chooseSchool');
  if (key === 'language') return t(language, 'config.chooseLanguage');
  if (key === 'timeFormat') return t(language, 'config.chooseFormat');
  if (key === 'hijriAdjustment') return t(language, 'config.chooseAdjustment');
  if (key === 'method') return t(language, 'config.chooseMethod');
  return t(language, 'config.keepHint');
}

async function runInteractiveConfig({ config, path, language, io, theme }) {
  if (!io.interactive) {
    io.stdout.write(`${renderConfigView({
      config,
      path,
      language,
      width: resolveTerminalWidth(io.columns),
      theme,
    })}\n`);
    return 0;
  }

  io.stdout.write(`${renderConfigView({
    config,
    path,
    language,
    width: resolveTerminalWidth(io.columns),
    theme,
  })}\n\n`);
  io.stdout.write(`${theme.gray(t(language, 'config.keepHint'))}\n\n`);

  const rl = createInterface({
    input: io.stdin,
    output: io.stdout,
    terminal: true,
  });

  let interrupted = false;
  rl.on('SIGINT', () => {
    interrupted = true;
    rl.close();
  });

  const patch = {};
  const next = { ...config };
  const width = resolveTerminalWidth(io.columns);

  try {
    for (const key of CONFIG_KEYS) {
      const current = configValueLabel(key, next, language);
      const hint = promptHint(key, language);
      let accepted = false;
      let attempts = 0;

      while (!accepted) {
        if (attempts > 0) {
          io.stdout.write(`${theme.red(wrapDisplay(hint, width).join('\n'))}\n`);
        }
        const prompt = `${theme.cyan(configLabel(key, next, language))} [${current}]: `;
        const answer = await rl.question(prompt);
        attempts += 1;
        const value = answer.trim();

        if (value === '') {
          accepted = true;
          break;
        }

        try {
          patch[key] = validateConfigValue(key, value);
          next[key] = patch[key];
          accepted = true;
        } catch (error) {
          io.stdout.write(`${theme.red(error.message)}\n`);
          if (attempts >= 5) {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (interrupted || error?.name === 'AbortError') {
      io.stdout.write(`\n${theme.gold(t(language, 'config.cancelled'))}\n`);
      return 130;
    }
    throw error;
  } finally {
    rl.close();
  }

  if (Object.keys(patch).length === 0) {
    io.stdout.write(`\n${theme.gray(t(language, 'config.unchanged'))}\n`);
    return 0;
  }

  const saved = saveConfig(next, { path });
  const savedLanguage = saved.config.language;
  io.stdout.write(`\n${theme.emerald(t(savedLanguage, 'config.wrote', { path }))}\n`);
  io.stdout.write(`${renderConfigView({
    config: saved.config,
    path,
    language: savedLanguage,
    width,
    theme,
  })}\n`);
  return 0;
}

async function handleConfig(args, context) {
  const { config, path, language, io, theme } = context;

  if (args.length === 0) {
    return runInteractiveConfig({ config, path, language, io, theme });
  }

  const key = resolveConfigKey(args[0]);
  if (!key) {
    throw new ValidationError(
      `Unknown configuration key "${args[0]}". Available keys: ${CONFIG_KEYS.join(', ')}.`,
      args[0],
    );
  }

  if (args.length === 1) {
    io.stdout.write(`${renderConfigView({
      config,
      path,
      language,
      width: resolveTerminalWidth(io.columns),
      theme,
      showMethods: key === 'method',
    })}\n`);
    return 0;
  }

  const rawValue = args.slice(1).join(' ');
  const value = validateConfigValue(key, rawValue);
  const next = { ...config, [key]: value };
  const saved = saveConfig(next, { path });
  const outputLanguage = saved.config.language;
  const displayValue = key === 'language'
    ? configValueLabel(key, saved.config, outputLanguage)
    : key === 'school'
      ? `${value} (${value === 1 ? 'Hanafi' : 'Shafi'})`
      : String(value).toLowerCase() === String(value).toUpperCase()
        ? String(value)
        : String(value);

  io.stdout.write(`${theme.emerald(t(outputLanguage, 'config.updated', {
    key: configLabel(key, saved.config, outputLanguage),
    value: displayValue,
  }))}\n`);
  io.stdout.write(`${theme.gray(t(outputLanguage, 'config.wrote', { path }))}\n`);
  return 0;
}

async function handleDashboard(context, forceRefresh) {
  const { baseConfig, overrides, io, theme } = context;
  const config = effectiveConfig(baseConfig, overrides);
  const timeoutMs = Number.parseInt(process.env.NOOR_TIMEOUT_MS ?? '', 10);
  const client = createAlAdhanClient({
    fetchImpl: io.fetchImpl,
    timeoutMs: Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    baseUrl: process.env.NOOR_API_BASE_URL,
  });
  const cache = new ResponseCache({
    path: io.cachePath ?? getCachePath(),
  });
  const service = createPrayerService({
    client,
    cache,
    now: io.now,
  });
  const data = await service.getDashboardData({
    config,
    forceRefresh,
  });

  if (
    cache.warnings.some((warning) => (
      warning.includes('not valid JSON')
      || warning.includes('unsupported shape')
      || warning.includes('could not be read')
    ))
  ) {
    data.warnings = [...(data.warnings ?? []), { key: 'cacheCorrupt', params: {} }];
  }

  const width = resolveTerminalWidth(io.columns);
  io.stdout.write(`${renderDashboard({
    config,
    data,
    width,
    theme,
    version: getVersion(),
  })}\n`);
  return 0;
}

/**
 * Run NOOR CLI. Returns a process exit code and writes to injected streams when
 * provided, making the command testable without spawning a shell.
 *
 * @param {string[]} argv
 * @param {{
 *   stdin?: NodeJS.ReadStream,
 *   stdout?: NodeJS.WriteStream,
 *   stderr?: NodeJS.WriteStream,
 *   columns?: number,
 *   fetchImpl?: Function,
 *   now?: () => DateTime,
 *   cachePath?: string,
 *   color?: boolean,
 *   unicode?: boolean,
 * }} [io]
 * @returns {Promise<number>}
 */
export async function runCli(argv = process.argv.slice(2), io = {}) {
  const stdin = io.stdin ?? process.stdin;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const columns = io.columns ?? stdout.columns;
  const outputTheme = createTheme({
    stream: stdout,
    color: io.color,
    unicode: io.unicode,
  });
  const errorTheme = createTheme({
    stream: stderr,
    color: io.color,
    unicode: io.unicode,
  });
  const streamIo = {
    stdin,
    stdout,
    stderr,
    columns,
    interactive: Boolean(stdin.isTTY && stdout.isTTY),
    fetchImpl: io.fetchImpl,
    now: io.now,
    cachePath: io.cachePath,
  };

  try {
    const parsed = parseArguments(argv);
    const loaded = loadConfig();
    const language = parsed.overrides.language ?? loaded.config.language;

    if (parsed.help || parsed.positionals[0] === 'help') {
      stdout.write(`${buildHelp(language, resolveTerminalWidth(columns), outputTheme)}\n`);
      return 0;
    }

    if (parsed.version || parsed.positionals[0] === 'version') {
      stdout.write(`${outputTheme.emerald(`${'NOOR CLI'} v${getVersion()}`)}\n`);
      return 0;
    }

    if (loaded.warnings.length > 0) {
      printWarnings(loaded.warnings, { stderr, columns }, errorTheme);
    }

    const context = {
      baseConfig: loaded.config,
      config: loaded.config,
      path: loaded.path,
      language,
      overrides: parsed.overrides,
      io: streamIo,
      theme: outputTheme,
    };

    const command = parsed.positionals[0];

    if (!command || command === 'dashboard') {
      return await handleDashboard(context, false);
    }

    if (command === 'refresh') {
      return await handleDashboard(context, true);
    }

    if (command === 'config') {
      return await handleConfig(parsed.positionals.slice(1), context);
    }

    throw new CliError(
      `Unknown command "${command}". Run "noor --help" for usage.`,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      stderr.write(`${errorTheme.red(`${error.message}`)}\n`);
      return 2;
    }
    if (error instanceof CliError) {
      stderr.write(`${errorTheme.red(`${error.message}`)}\n`);
      return error.exitCode;
    }
    stderr.write(`${errorTheme.red(`Error: ${error?.message ?? String(error)}`)}\n`);
    return 1;
  }
}

export { buildHelp, parseArguments, runInteractiveConfig };
