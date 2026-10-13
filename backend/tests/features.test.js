const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dateRange } = require('../src/utils/dateRange');
const { canRetry } = require('../src/utils/retryPolicy');
test('date filters reject invalid or reversed ranges', () => {
  assert.throws(() => dateRange('invalid', ''), /Data inválida/);
  assert.throws(() => dateRange('2026-10-13', '2026-10-12'), /início/);
  assert.equal(dateRange('2026-10-13', '').createdAt.gte.toISOString(), '2026-10-13T00:00:00.000Z');
});
test('automatic retries never repeat mutations or ordinary client errors', () => {
  const result = { status: 'ERROR', httpStatus: 503 };
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(canRetry(method, result, 1, 3), false);
  assert.equal(canRetry('GET', result, 1, 3), true);
  assert.equal(canRetry('GET', result, 4, 3), false);
  assert.equal(canRetry('GET', { ...result, httpStatus: 404 }, 1, 3), false);
});
