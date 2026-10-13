const prisma = require('../config/prisma');
const { AppError } = require('../utils/AppError');
const { ownerWhere } = require('../utils/accessScope');

function integer(value, min, max, label) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max) throw new AppError(`${label}: informe um inteiro entre ${min} e ${max}.`, 400);
  return result;
}
async function settings(id, payload, user) {
  const integration = await prisma.integration.findFirst({ where: { id: Number(id), ...ownerWhere(user) } });
  if (!integration) throw new AppError('Integração não encontrada.', 404);
  const scheduleMinutes = payload.scheduleMinutes === null || payload.scheduleMinutes === '' ? null : integer(payload.scheduleMinutes, 1, 10080, 'Intervalo');
  const maxRetries = integer(payload.maxRetries, 0, 3, 'Tentativas extras');
  if (maxRetries && integration.method !== 'GET') throw new AppError('Tentativas automáticas são permitidas apenas para GET.', 400);
  const data = { scheduleMinutes, nextRunAt: scheduleMinutes ? new Date(Date.now() + scheduleMinutes * 60000) : null, maxRetries,
    failureThreshold: integer(payload.failureThreshold, 1, 20, 'Falhas consecutivas'), slowThresholdMs: integer(payload.slowThresholdMs, 100, 30000, 'Lentidão em ms') };
  return prisma.$transaction(async tx => {
    const saved = await tx.integration.update({ where: { id: integration.id }, data });
    await tx.auditEvent.create({ data: { integrationId: integration.id, actorId: user.id, action: 'AUTOMATION_UPDATED' } });
    return { integrationId: saved.id, ...data };
  });
}
async function overview(user, ownerId) {
  const scope = ownerWhere(user, ownerId);
  const [alerts, jobs] = await Promise.all([
    prisma.integrationAlert.findMany({ where: { integration: { is: scope }, acknowledgedAt: null }, orderBy: { id: 'desc' }, take: 100, include: { integration: { select: { id: true, name: true } } } }),
    prisma.executionJob.findMany({ where: { integration: { is: scope }, state: { in: ['PENDING', 'RUNNING'] } }, orderBy: { runAt: 'asc' }, take: 100, include: { integration: { select: { id: true, name: true } } } })
  ]);
  return { alerts, jobs };
}
async function acknowledge(id, user) {
  const result = await prisma.integrationAlert.updateMany({ where: { id: Number(id), integration: { is: ownerWhere(user) }, acknowledgedAt: null }, data: { acknowledgedAt: new Date() } });
  if (!result.count) throw new AppError('Alerta não encontrado.', 404);
}
module.exports = { settings, overview, acknowledge, integer };
