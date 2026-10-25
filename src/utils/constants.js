export const APP_NAME = 'NOOR CLI';
export const APP_TAGLINE = 'Where Time Meets Tranquility';

export const DEFAULT_CONFIG = Object.freeze({
  city: 'Dhaka',
  country: 'Bangladesh',
  timezone: 'Asia/Dhaka',
  method: 1,
  school: 0,
  language: 'en',
  timeFormat: '12h',
  hijriAdjustment: 0,
});

export const CONFIG_KEYS = Object.freeze([
  'city',
  'country',
  'timezone',
  'method',
  'school',
  'language',
  'timeFormat',
  'hijriAdjustment',
]);

export const CONFIG_KEY_ALIASES = Object.freeze({
  format: 'timeFormat',
  adjustment: 'hijriAdjustment',
});

export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'bn']);
export const SUPPORTED_TIME_FORMATS = Object.freeze(['12h', '24h']);
export const HIJRI_ADJUSTMENT_MIN = -3;
export const HIJRI_ADJUSTMENT_MAX = 3;

export const SCHOOLS = Object.freeze([
  { value: 1, name: 'Hanafi', bn: 'হানাফি' },
  { value: 0, name: 'Shafi', bn: 'শাফি' },
]);

/**
 * AlAdhan calculation method IDs. Method 1 is the requested initial default.
 * The list intentionally excludes the custom (99) method because it requires
 * additional calculation parameters that NOOR CLI does not expose.
 */
export const PRAYER_METHODS = Object.freeze([
  {
    id: 0,
    name: 'Shia Ithna-Ashari, Leva Institute, Qum',
    shortName: 'Jafari / Leva Institute',
  },
  {
    id: 1,
    name: 'University of Islamic Sciences, Karachi',
    shortName: 'Karachi',
  },
  {
    id: 2,
    name: 'Islamic Society of North America (ISNA)',
    shortName: 'ISNA',
  },
  {
    id: 3,
    name: 'Muslim World League',
    shortName: 'Muslim World League',
  },
  {
    id: 4,
    name: 'Umm Al-Qura University, Makkah',
    shortName: 'Umm Al-Qura',
  },
  {
    id: 5,
    name: 'Egyptian General Authority of Survey',
    shortName: 'Egyptian Authority',
  },
  {
    id: 7,
    name: 'Institute of Geophysics, University of Tehran',
    shortName: 'Tehran',
  },
  {
    id: 8,
    name: 'Gulf Region',
    shortName: 'Gulf Region',
  },
  {
    id: 9,
    name: 'Kuwait',
    shortName: 'Kuwait',
  },
  {
    id: 10,
    name: 'Qatar',
    shortName: 'Qatar',
  },
  {
    id: 11,
    name: 'Majlis Ugama Islam Singapura, Singapore',
    shortName: 'Singapore MUIS',
  },
  {
    id: 12,
    name: 'Union Organization Islamic de France',
    shortName: 'France UOIF',
  },
  {
    id: 13,
    name: 'Diyanet İşleri Başkanlığı, Turkey (experimental)',
    shortName: 'Turkey Diyanet',
  },
  {
    id: 14,
    name: 'Spiritual Administration of Muslims of Russia',
    shortName: 'Russia',
  },
  {
    id: 15,
    name: 'Moonsighting Committee Worldwide',
    shortName: 'Moonsighting Committee',
  },
  {
    id: 16,
    name: 'Dubai (experimental)',
    shortName: 'Dubai',
  },
  {
    id: 17,
    name: 'Jabatan Kemajuan Islam Malaysia (JAKIM)',
    shortName: 'Malaysia JAKIM',
  },
  {
    id: 18,
    name: 'Tunisia',
    shortName: 'Tunisia',
  },
  {
    id: 19,
    name: 'Algeria',
    shortName: 'Algeria',
  },
  {
    id: 20,
    name: 'Kementerian Agama Republik Indonesia',
    shortName: 'Indonesia Kemenag',
  },
  {
    id: 21,
    name: 'Morocco',
    shortName: 'Morocco',
  },
  {
    id: 22,
    name: 'Comunidade Islamica de Lisboa',
    shortName: 'Portugal',
  },
  {
    id: 23,
    name: 'Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan',
    shortName: 'Jordan',
  },
]);

export const PRAYER_METHOD_IDS = Object.freeze(
  new Set(PRAYER_METHODS.map((method) => method.id)),
);

export function getPrayerMethod(id) {
  return PRAYER_METHODS.find((method) => method.id === Number(id)) ?? null;
}
