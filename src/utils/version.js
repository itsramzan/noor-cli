import { readFileSync } from 'node:fs';

let cachedVersion = null;

export function getVersion() {
  if (cachedVersion) return cachedVersion;

  try {
    const packageUrl = new URL('../../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8'));
    cachedVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }

  return cachedVersion;
}
