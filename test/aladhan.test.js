import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AlAdhanHttpError,
  AlAdhanNetworkError,
  AlAdhanRejectedError,
  AlAdhanResponseError,
  AlAdhanTimeoutError,
  createAlAdhanClient,
  formatApiDate,
} from '../src/api/aladhan.js';
import { DateTime } from 'luxon';
import {
  jsonResponse,
  makeHijriPayload,
  makeTimingsPayload,
} from './helpers.js';

const date = DateTime.fromISO('2026-10-25', { zone: 'Asia/Dhaka' });

const request = {
  date,
  city: 'Dhaka',
  country: 'Bangladesh',
  method: 1,
  school: 0,
  timezone: 'Asia/Dhaka',
};

test('timingsByCity builds the expected request and normalizes timings', async () => {
  let requestedUrl = null;
  const client = createAlAdhanClient({
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return jsonResponse(makeTimingsPayload());
    },
  });

  const result = await client.timingsByCity(request);
  assert.match(requestedUrl, /timingsByCity\/25-10-2026\?/);
  assert.match(requestedUrl, /city=Dhaka/);
  assert.match(requestedUrl, /country=Bangladesh/);
  assert.match(requestedUrl, /method=1/);
  assert.match(requestedUrl, /school=0/);
  assert.match(requestedUrl, /timezonestring=Asia%2FDhaka/);
  assert.equal(result.clocks.Fajr, '04:44');
  assert.deepEqual(result.times.Maghrib, { hour: 17, minute: 24, second: 0 });
  assert.equal(result.hijri.day, '14');
  assert.equal(result.timezone, 'Asia/Dhaka');
});

test('formatApiDate accepts DateTime, ISO, and existing API dates', () => {
  assert.equal(formatApiDate(date), '25-10-2026');
  assert.equal(formatApiDate('2026-10-25'), '25-10-2026');
  assert.equal(formatApiDate('25-10-2026'), '25-10-2026');
});

test('missing required timings fail validation', async () => {
  const payload = makeTimingsPayload();
  delete payload.data.timings.Fajr;

  const client = createAlAdhanClient({
    fetchImpl: async () => jsonResponse(payload),
  });

  await assert.rejects(
    client.timingsByCity(request),
    (error) => {
      assert.ok(error instanceof AlAdhanResponseError);
      assert.equal(error.reason, 'invalidResponse');
      assert.match(error.message, /Fajr/);
      return true;
    },
  );
});

test('malformed JSON is reported distinctly', async () => {
  const client = createAlAdhanClient({
    fetchImpl: async () => jsonResponse('{not json', 200),
  });

  await assert.rejects(
    client.timingsByCity(request),
    (error) => {
      assert.ok(error instanceof AlAdhanResponseError);
      assert.equal(error.reason, 'invalidJson');
      return true;
    },
  );
});

test('HTTP and API rejection errors expose their reason and status', async () => {
  const httpClient = createAlAdhanClient({
    fetchImpl: async () => jsonResponse({ message: 'nope' }, 500),
  });

  await assert.rejects(
    httpClient.timingsByCity(request),
    (error) => {
      assert.ok(error instanceof AlAdhanHttpError);
      assert.equal(error.reason, 'http');
      assert.equal(error.status, 500);
      return true;
    },
  );

  const rejectedClient = createAlAdhanClient({
    fetchImpl: async () => jsonResponse({
      code: 400,
      status: 'BAD_REQUEST',
      data: 'Invalid city',
    }),
  });

  await assert.rejects(
    rejectedClient.timingsByCity(request),
    (error) => {
      assert.ok(error instanceof AlAdhanRejectedError);
      assert.equal(error.reason, 'rejected');
      return true;
    },
  );
});

test('network errors are classified without fabricating data', async () => {
  const client = createAlAdhanClient({
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });

  await assert.rejects(
    client.timingsByCity(request),
    (error) => {
      assert.ok(error instanceof AlAdhanNetworkError);
      assert.equal(error.reason, 'network');
      return true;
    },
  );
});

test('timeouts abort the request and report a timeout', async () => {
  const client = createAlAdhanClient({
    timeoutMs: 20,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }),
  });

  await assert.rejects(
    client.timingsByCity(request),
    (error) => {
      assert.ok(error instanceof AlAdhanTimeoutError);
      assert.equal(error.reason, 'timeout');
      return true;
    },
  );
});

test('gregorianToHijri shifts the Gregorian date and validates the result', async () => {
  let requestedUrl = null;
  const client = createAlAdhanClient({
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return jsonResponse(makeHijriPayload());
    },
  });

  const result = await client.gregorianToHijri({ date, adjustment: 1 });
  assert.match(requestedUrl, /gToH\/26-10-2026$/);
  assert.equal(result.hijri.day, '15');
  assert.equal(result.targetDate, '2026-10-26');

  const invalid = createAlAdhanClient({
    fetchImpl: async () => jsonResponse({
      code: 200,
      status: 'OK',
      data: { gregorian: {} },
    }),
  });
  await assert.rejects(
    invalid.gregorianToHijri({ date }),
    (error) => {
      assert.equal(error.reason, 'invalidResponse');
      return true;
    },
  );
});
