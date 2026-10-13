const { createHash } = require('node:crypto');

function createLoginLimiter({ now = Date.now, maxEntries = 10000, ipLimit = 30, accountLimit = 10, windowMs = 15 * 60000 } = {}) {
  const attempts = new Map();
  return function loginLimiter(req, res, next) {
    const time = now();
    // Prune expired windows and bound memory even if an attacker rotates email addresses.
    for (const [key, record] of attempts) if (record.until <= time) attempts.delete(key);
    const ip = req.ip || req.socket.remoteAddress;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    const account = createHash('sha256').update(email).digest('hex');
    const keys = [[`ip:${ip}`, ipLimit], [`account:${ip}:${account}`, accountLimit]];
    for (const [key, limit] of keys) {
      const record = attempts.get(key);
      if (record && record.count >= limit) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((record.until - time) / 1000)));
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
      }
    }
    if (attempts.size + keys.filter(([key]) => !attempts.has(key)).length > maxEntries) {
      res.setHeader('Retry-After', 60);
      return res.status(429).json({ success: false, message: 'Limite de tentativas atingido. Aguarde.' });
    }
    // Reserve both attempts synchronously, before any asynchronous password hashing.
    for (const [key] of keys) {
      const record = attempts.get(key) || { count: 0, until: time + windowMs };
      record.count++; attempts.set(key, record);
    }
    next();
  };
}
module.exports = { createLoginLimiter };
