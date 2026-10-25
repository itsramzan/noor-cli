#!/usr/bin/env node

import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';
import { runCli } from './cli.js';

// Termux and some mobile networks advertise unreachable IPv6 addresses. Node's
// fetch otherwise races both families and can time out on the unreachable one
// before IPv4 is used. Prefer IPv4 and disable Happy Eyeballs so the first
// resolved address is used directly. IPv6-only networks still work because the
// AAAA record remains the only result.
try {
  setDefaultResultOrder('ipv4first');
  setDefaultAutoSelectFamily(false);
} catch {
  // Older Node versions can ignore this; fetch remains functional.
}

runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = Number.isInteger(code) ? code : 0;
  })
  .catch((error) => {
    process.stderr.write(`Error: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  });
