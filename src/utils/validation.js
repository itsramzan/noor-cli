import { IANAZone } from 'luxon';
import {
  HIJRI_ADJUSTMENT_MAX,
  HIJRI_ADJUSTMENT_MIN,
  PRAYER_METHOD_IDS,
  SUPPORTED_LANGUAGES,
  SUPPORTED_TIME_FORMATS,
} from './constants.js';

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

function textValue(value, field, maxLength = 80) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be text.`, field);
  }

  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length === 0) {
    throw new ValidationError(`${field} cannot be empty.`, field);
  }
  if (text.length > maxLength) {
    throw new ValidationError(`${field} must be at most ${maxLength} characters.`, field);
  }
  // Reject control characters and markup-looking values early. The API query
  // is encoded with URLSearchParams, so this is validation, not escaping.
  if (/[\u0000-\u001f\u007f<>]/.test(text)) {
    throw new ValidationError(`${field} contains unsupported characters.`, field);
  }

  return text;
}

export function validateCity(value) {
  return textValue(value, 'City', 80);
}

export function validateCountry(value) {
  return textValue(value, 'Country', 80);
}

export function validateTimezone(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError('Timezone cannot be empty.', 'timezone');
  }

  const timezone = value.trim();
  if (!IANAZone.isValidZone(timezone)) {
    throw new ValidationError(
      `"${timezone}" is not a valid IANA timezone. Example: Asia/Dhaka`,
      'timezone',
    );
  }
  return timezone;
}

function integerValue(value, field) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new ValidationError(`${field} must be a whole number.`, field);
    }
    return value;
  }

  if (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  throw new ValidationError(`${field} must be a whole number.`, field);
}

export function validateMethod(value) {
  const method = integerValue(value, 'Calculation method');
  if (!PRAYER_METHOD_IDS.has(method)) {
    throw new ValidationError(
      `Unsupported calculation method "${value}". Run "noor config method" to see supported IDs.`,
      'method',
    );
  }
  return method;
}

export function validateSchool(value) {
  if (typeof value === 'number') {
    if (value === 0 || value === 1) return value;
    throw new ValidationError('School must be 0 (Shafi) or 1 (Hanafi).', 'school');
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'hanafi') return 1;
    if (normalized === '0' || normalized === 'shafi' || normalized === 'shafii') return 0;
  }

  throw new ValidationError(
    'School must be Hanafi (1) or Shafi (0).',
    'school',
  );
}

export function validateLanguage(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('Language must be en or bn.', 'language');
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'en' || normalized === 'english') return 'en';
  if (normalized === 'bn' || normalized === 'bangla' || normalized === 'bengali') return 'bn';

  throw new ValidationError('Language must be en (English) or bn (Bangla).', 'language');
}

export function validateTimeFormat(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('Clock format must be 12h or 24h.', 'timeFormat');
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '12' || normalized === '12h' || normalized === '12-hour') return '12h';
  if (normalized === '24' || normalized === '24h' || normalized === '24-hour') return '24h';

  throw new ValidationError('Clock format must be 12h or 24h.', 'timeFormat');
}

export function validateHijriAdjustment(value) {
  const adjustment = integerValue(value, 'Hijri adjustment');
  if (adjustment < HIJRI_ADJUSTMENT_MIN || adjustment > HIJRI_ADJUSTMENT_MAX) {
    throw new ValidationError(
      `Hijri adjustment must be between ${HIJRI_ADJUSTMENT_MIN} and ${HIJRI_ADJUSTMENT_MAX} days.`,
      'hijriAdjustment',
    );
  }
  return adjustment;
}

const VALIDATORS = {
  city: validateCity,
  country: validateCountry,
  timezone: validateTimezone,
  method: validateMethod,
  school: validateSchool,
  language: validateLanguage,
  timeFormat: validateTimeFormat,
  hijriAdjustment: validateHijriAdjustment,
};

export function validateConfigValue(field, value) {
  const validator = VALIDATORS[field];
  if (!validator) {
    throw new ValidationError(`Unknown configuration key "${field}".`, field);
  }
  return validator(value);
}

export function assertPlainObject(value, label = 'Configuration') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} must be a JSON object.`);
  }
  return value;
}

export { SUPPORTED_LANGUAGES, SUPPORTED_TIME_FORMATS };
