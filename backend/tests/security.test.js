const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoginLimiter } = require('../src/middlewares/loginLimiter');
const { inspectFile } = require('../scripts/security-check');
const { validateDemoTarget } = require('../scripts/seed-demo');

function attempt(limiter, email = 'test@example.test', ip = '127.0.0.1') {
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  let allowed = false;
  limiter({ ip, body: { email } }, response, () => { allowed = true; });
  return { allowed, response };
}
test('login attempts are reserved before async work and blocked across rotated emails', () => {
  let time = 1000;
  const limiter = createLoginLimiter({ now: () => time, accountLimit: 2, ipLimit: 3, windowMs: 1000 });
  assert.equal(attempt(limiter).allowed, true);
  assert.equal(attempt(limiter).allowed, true);
  assert.equal(attempt(limiter).response.statusCode, 429);
  assert.equal(attempt(limiter, 'other@example.test').allowed, true);
  assert.equal(attempt(limiter, 'third@example.test').response.statusCode, 429);
  time += 1001;
  assert.equal(attempt(limiter).allowed, true);
});
test('login limiter does not evict records to bypass limits when capacity is reached', () => {
  const limiter = createLoginLimiter({ maxEntries: 2 });
  assert.equal(attempt(limiter).allowed, true);
  assert.equal(attempt(limiter, 'other@example.test').response.statusCode, 429);
});
test('Git verification detects private files and credentials without printing their values', () => {
  assert.ok(inspectFile('backend/.env', 'PORT=3000').length);
  assert.ok(inspectFile('db.backup', '').length);
  assert.ok(inspectFile('.tmp/db.json', '').length);
  assert.ok(inspectFile('credentials.txt', '-----BEGIN ' + 'PRIVATE KEY-----').length);
  assert.ok(inspectFile('config.js', 'postgresql://' + 'user:real-secret-value@host/db').length);
  assert.deepEqual(inspectFile('backend/.env.example', 'CREDENTIAL_ENCRYPTION_KEY=\nDATABASE_URL=postgresql://user:troque_a_senha@localhost/db'), []);
});
test('demo seed refuses production, admins, inactive users and non-demo accounts', () => {
  const email = 'test@integrahub.local';
  const user = { email, isActive: true, role: 'USER' };
  const options = { email, allowDemoData: true };
  assert.doesNotThrow(() => validateDemoTarget(user, options, 'development'));
  assert.throws(() => validateDemoTarget(user, options, 'production'));
  assert.throws(() => validateDemoTarget(user, { ...options, allowDemoData: false }, 'development'));
  assert.throws(() => validateDemoTarget({ ...user, role: 'ADMIN' }, options, 'development'));
  assert.throws(() => validateDemoTarget({ ...user, isActive: false }, options, 'development'));
  assert.throws(() => validateDemoTarget(user, { ...options, email: 'user@example.com' }, 'development'));
});
