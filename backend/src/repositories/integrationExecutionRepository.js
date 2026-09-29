const prisma = require("../config/prisma");

async function create(data, actorId) {
  return prisma.$transaction(async (tx) => {
    const execution = await tx.integrationExecution.create({ data });
    await tx.auditEvent.create({
      data: {
        action: "EXECUTION_STARTED", integrationId: execution.integrationId,
        executionId: execution.id, status: execution.status, actorId
      }
    });
    return execution;
  });
}

async function update(id, data, actorId) {
  return prisma.$transaction(async (tx) => {
    const execution = await tx.integrationExecution.update({ where: { id }, data });
    await tx.auditEvent.create({
      data: {
        action: "EXECUTION_FINISHED", integrationId: execution.integrationId,
        executionId: id, status: execution.status,
        httpStatus: execution.httpStatus, durationMs: execution.durationMs, actorId
      }
    });
    return execution;
  });
}

async function findAll(page, pageSize, status, integrationId, scope = {}) {
  return prisma.integrationExecution.findMany({
    where: { ...(status && { status }), ...(integrationId && { integrationId }), ...scope },
    select: {
      id: true, integrationId: true, status: true, httpStatus: true,
      durationMs: true, startedAt: true, finishedAt: true, createdAt: true,
      errorMessage: true,
      integration: { select: { id: true, name: true, ownerId: true,
        owner: { select: { id: true, email: true } } } }
    },
    orderBy: { id: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize
  });
}

async function countAll(status, integrationId, scope = {}) {
  return prisma.integrationExecution.count({
    where: { ...(status && { status }), ...(integrationId && { integrationId }), ...scope }
  });
}

async function findByIntegrationId(integrationId, page, pageSize) {
  return prisma.integrationExecution.findMany({
    where: {
      integrationId
    },
    select: {
      id: true,
      integrationId: true,
      status: true,
      httpStatus: true,
      durationMs: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true
    },
    orderBy: {
      id: "desc"
    },
    skip: (page - 1) * pageSize,
    take: pageSize
  });
}

async function countByIntegrationId(integrationId) {
  return prisma.integrationExecution.count({ where: { integrationId } });
}

async function recoverStaleRunning(before, finishedAt) {
  return prisma.$transaction(async (tx) => {
    const stale = await tx.integrationExecution.findMany({
      where: { status: "RUNNING", startedAt: { lt: before } },
      select: { id: true, integrationId: true }
    });
    let recovered = 0;
    for (const execution of stale) {
      const result = await tx.integrationExecution.updateMany({
        where: { id: execution.id, status: "RUNNING" },
        data: {
          status: "ERROR", finishedAt,
          errorMessage: "Execução interrompida antes da finalização."
        }
      });
      if (result.count) {
        recovered++;
        await tx.auditEvent.create({
          data: {
            action: "EXECUTION_RECOVERED", integrationId: execution.integrationId,
            executionId: execution.id, status: "ERROR"
          }
        });
      }
    }
    return { count: recovered };
  });
}

async function findById(id, scope = {}) {
  return prisma.integrationExecution.findFirst({
    where: { id, ...scope },
    include: {
      integration: {
        select: {
          id: true,
          name: true,
          description: true,
          status: true, ownerId: true,
          owner: { select: { id: true, email: true } }
        }
      }
    }
  });
}

async function countTodayByStatus(startOfDay, endOfDay, status, scope = {}) {
  return prisma.integrationExecution.count({
    where: {
      status,
      ...scope,
      createdAt: {
        gte: startOfDay,
        lt: endOfDay
      }
    }
  });
}

async function countToday(startOfDay, endOfDay, scope = {}) {
  return prisma.integrationExecution.count({
    where: {
      ...scope,
      createdAt: {
        gte: startOfDay,
        lt: endOfDay
      }
    }
  });
}

module.exports = {
  create,
  update,
  findAll,
  countAll,
  findByIntegrationId,
  countByIntegrationId,
  recoverStaleRunning,
  findById,
  countToday,
  countTodayByStatus
};
