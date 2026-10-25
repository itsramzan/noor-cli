const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/**
 * Convert every ASCII digit in a value to its Bengali counterpart while
 * preserving punctuation, signs, and other scripts.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function toBengaliDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, (digit) => BENGALI_DIGITS[Number(digit)]);
}

/**
 * Format a number for the active interface language.
 *
 * @param {unknown} value
 * @param {'en'|'bn'} language
 * @returns {string}
 */
export function localizeNumber(value, language = 'en') {
  const text = String(value ?? '');
  return language === 'bn' ? toBengaliDigits(text) : text;
}

/**
 * Pad a number to two digits using the requested numeral system.
 *
 * @param {number} value
 * @param {'en'|'bn'} language
 * @returns {string}
 */
export function padTwo(value, language = 'en') {
  return localizeNumber(String(Math.trunc(Number(value))).padStart(2, '0'), language);
}
