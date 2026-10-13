const { createHash } = require('node:crypto');
const prisma = require('../config/prisma');
async function requestFingerprint(integration, client = prisma) {
  const environment = integration.environmentId ? await client.environment.findUnique({ where: { id: integration.environmentId }, select: { encryptedVariables: true } }) : null;
  return createHash('sha256').update(JSON.stringify([
    integration.baseUrl, integration.method, integration.headers, integration.queryParams, integration.body,
    integration.environmentId, environment?.encryptedVariables
  ])).digest('hex');
}
module.exports = { requestFingerprint };
