const prisma = require('../config/prisma');
const { sanitizeExecution } = require('../utils/headerMasker');
const { executeHttpRequest } = require('./httpClientService');
const { canRetry } = require('../utils/retryPolicy');
let timer;
let ticking = false;
const active = new Set();
function concurrency() { return Math.max(1, Math.min(10, Number(process.env.EXECUTION_CONCURRENCY) || 3)); }

async function enqueue(integration, actorId, tx = prisma) {
  const execution = await tx.integrationExecution.create({ data: {
    integrationId: integration.id, status: 'PENDING',
    ...sanitizeExecution({ requestUrl: integration.baseUrl, requestMethod: integration.method, requestHeaders: integration.headers, requestQueryParams: integration.queryParams, requestBody: integration.body })
  } });
  await tx.executionJob.create({ data: { integrationId: integration.id, executionId: execution.id, actorId } });
  await tx.auditEvent.create({ data: { integrationId: integration.id, executionId: execution.id, actorId, action: 'EXECUTION_QUEUED', status: 'PENDING' } });
  return { ...execution, integration: { id: integration.id, name: integration.name } };
}
async function createAlerts(tx, integration, result) {
  const recent = await tx.integrationExecution.findMany({ where: { integrationId: integration.id, status: { in: ['SUCCESS', 'ERROR'] } }, orderBy: { id: 'desc' }, take: integration.failureThreshold });
  const conditions = [
    ['FAILURES', recent.length >= integration.failureThreshold && recent.every(item => item.status === 'ERROR'), `${integration.failureThreshold} falhas consecutivas.`],
    ['SLOW', result.durationMs >= integration.slowThresholdMs, `Execução levou ${result.durationMs} ms (limite ${integration.slowThresholdMs} ms).`]
  ];
  // Serialize alert creation for the same integration across workers.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${integration.id})`;
  for (const [kind, triggered, message] of conditions) {
    if (!triggered) continue;
    if (!await tx.integrationAlert.findFirst({ where: { integrationId: integration.id, kind, acknowledgedAt: null } })) await tx.integrationAlert.create({ data: { integrationId: integration.id, kind, message } });
  }
}
async function runJob(job) {
  const integration = await prisma.integration.findUnique({ where: { id: job.integrationId }, include: { owner: { select: { isActive: true } } } });
  let result;
  if (!integration || integration.status !== 'ACTIVE' || integration.owner?.isActive === false) {
    result = { status: 'ERROR', httpStatus: null, errorMessage: 'Integração ou proprietário inativo.', finishedAt: new Date(), durationMs: 0 };
  } else {
    await prisma.integrationExecution.update({ where: { id: job.executionId }, data: { status: 'RUNNING', startedAt: new Date() } });
    result = await executeHttpRequest(integration);
  }
  if (integration && canRetry(integration.method, result, job.attempts, integration.maxRetries)) {
    await prisma.$transaction([
      prisma.executionJob.update({ where: { id: job.id }, data: { state: 'PENDING', claimedAt: null, runAt: new Date(Date.now() + 1000 * 2 ** job.attempts) } }),
      prisma.integrationExecution.update({ where: { id: job.executionId }, data: { status: 'PENDING', startedAt: null } })
    ]);
    return;
  }
  await prisma.$transaction(async tx => {
    await tx.integrationExecution.update({ where: { id: job.executionId }, data: { ...result, responseBody: sanitizeExecution({ responseBody: result.responseBody ?? null }).responseBody } });
    await tx.executionJob.update({ where: { id: job.id }, data: { state: 'DONE', finishedAt: new Date() } });
    await tx.auditEvent.create({ data: { integrationId: job.integrationId, executionId: job.executionId, actorId: job.actorId, action: 'EXECUTION_FINISHED', status: result.status, httpStatus: result.httpStatus, durationMs: result.durationMs } });
    if (integration) await createAlerts(tx, integration, result);
  });
}
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const now = new Date();
    const due = await prisma.integration.findMany({ where: { status: 'ACTIVE', nextRunAt: { lte: now }, scheduleMinutes: { not: null }, OR: [{ ownerId: null }, { owner: { is: { isActive: true } } }] }, take: 50 });
    for (const integration of due) await prisma.$transaction(async tx => {
      const claim = await tx.integration.updateMany({ where: { id: integration.id, nextRunAt: integration.nextRunAt }, data: { nextRunAt: new Date(now.getTime() + integration.scheduleMinutes * 60000) } });
      if (claim.count && !await tx.executionJob.findFirst({ where: { integrationId: integration.id, state: { in: ['PENDING', 'RUNNING'] } } })) await enqueue(integration, integration.ownerId, tx);
    });
    // A crash is never replayed automatically: a remote mutation may already have succeeded.
    const abandoned = await prisma.executionJob.findMany({ where: { state: 'RUNNING', claimedAt: { lt: new Date(Date.now() - 120000) } }, take: 50 });
    for (const job of abandoned) await prisma.$transaction(async tx => {
      const changed = await tx.executionJob.updateMany({ where: { id: job.id, state: 'RUNNING', claimedAt: job.claimedAt }, data: { state: 'DONE', finishedAt: now } });
      if (changed.count) {
        await tx.integrationExecution.update({ where: { id: job.executionId }, data: { status: 'ERROR', finishedAt: now, errorMessage: 'Worker interrompido. Confira o destino antes de executar novamente.' } });
        await tx.auditEvent.create({ data: { integrationId: job.integrationId, executionId: job.executionId, actorId: job.actorId, action: 'EXECUTION_RECOVERED', status: 'ERROR' } });
      }
    });
    // Database lock enforces a global concurrency cap, even with multiple API processes.
    const jobs = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9843271)`;
      const running = await tx.executionJob.count({ where: { state: 'RUNNING' } });
      const pending = await tx.executionJob.findMany({ where: { state: 'PENDING', runAt: { lte: now } }, take: Math.max(0, concurrency() - running), orderBy: { id: 'asc' } });
      const claimed = [];
      for (const job of pending) {
        const claim = await tx.executionJob.updateMany({ where: { id: job.id, state: 'PENDING' }, data: { state: 'RUNNING', claimedAt: now, attempts: { increment: 1 } } });
        if (claim.count) claimed.push({ ...job, attempts: job.attempts + 1 });
      }
      return claimed;
    });
    for (const job of jobs) {
      const task = runJob(job).catch(error => console.error('Falha ao processar tarefa:', error.code || error.name)).finally(() => active.delete(task));
      active.add(task);
    }
  } finally { ticking = false; }
}
function startWorker() {
  if (timer) return;
  const run = () => tick().catch(error => console.error('Fila indisponível:', error.code || error.name));
  timer = setInterval(run, 1000); timer.unref(); run();
}
async function stopWorker() { clearInterval(timer); timer = null; await Promise.allSettled([...active]); }
module.exports = { enqueue, tick, startWorker, stopWorker };
