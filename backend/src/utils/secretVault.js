const crypto = require('node:crypto');
const { AppError } = require('./AppError');
function vaultKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new AppError('Configure CREDENTIAL_ENCRYPTION_KEY com uma chave base64 de 32 bytes para usar credenciais.', 503);
  return key;
}
function encryptVariables(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(item => item.toString('base64')).join('.');
}
function decryptVariables(value) {
  const [iv, tag, data] = value.split('.').map(item => Buffer.from(item, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}
function interpolate(value, variables) {
  if (typeof value === 'string') return value.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (_, key) => {
    if (!Object.hasOwn(variables, key)) throw new AppError(`Variável ${key} não definida no ambiente.`, 400);
    return variables[key];
  });
  if (Array.isArray(value)) return value.map(item => interpolate(item, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, variables)]));
  return value;
}
function redactKnownSecrets(value, variables) {
  if (typeof value === 'string') {
    for (const secret of Object.values(variables).filter(Boolean).sort((a, b) => b.length - a.length)) {
      value = value.split(secret).join('********').split(encodeURIComponent(secret)).join('********');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(item => redactKnownSecrets(item, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [redactKnownSecrets(key, variables), redactKnownSecrets(item, variables)]));
  return value;
}
module.exports = { encryptVariables, decryptVariables, interpolate, redactKnownSecrets };
