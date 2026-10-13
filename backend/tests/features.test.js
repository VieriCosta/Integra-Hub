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
test('vault encrypts credentials, rejects tampering and masks echoed values', () => {
  const crypto = require('node:crypto');
  const vault = require('../src/utils/secretVault');
  const old = process.env.CREDENTIAL_ENCRYPTION_KEY;
  process.env.CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  try {
    const variables = { API_TOKEN: 'credential-do-not-leak', BASE_URL: 'https://1.1.1.1' };
    const encrypted = vault.encryptVariables(variables);
    assert.ok(!encrypted.includes(variables.API_TOKEN));
    assert.deepEqual(vault.decryptVariables(encrypted), variables);
    const parts = encrypted.split('.');
    const data = Buffer.from(parts[2], 'base64'); data[0] ^= 1; parts[2] = data.toString('base64');
    assert.throws(() => vault.decryptVariables(parts.join('.')));
    assert.equal(vault.interpolate('Bearer {{API_TOKEN}}', variables), 'Bearer credential-do-not-leak');
    assert.throws(() => vault.interpolate('{{UNKNOWN}}', variables), /não definida/);
    assert.equal(vault.redactKnownSecrets('echo: credential-do-not-leak', variables), 'echo: ********');
  } finally { if (old === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY; else process.env.CREDENTIAL_ENCRYPTION_KEY = old; }
});
