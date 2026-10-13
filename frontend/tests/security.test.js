const { test } = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server');
test('static server blocks internal files and sends security headers', async () => {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const file of ['/package.json', '/server.js', '/.env', '/assets/.env', '/assets/secret.pem', '/%2e%2e%5cbackend%5c.env']) {
      const response = await fetch(base + file);
      assert.equal(response.status, 403, file);
    }
    for (const file of ['/dashboard/index.html', '/assets/js/dashboard.js', '/assets/css/style.css']) {
      const response = await fetch(base + file);
      assert.equal(response.status, 200, file);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
    }
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/favicon.ico')).status, 204);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
