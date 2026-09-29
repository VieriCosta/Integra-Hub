const prisma = require("../config/prisma");

function whereFor(action, integrationId) {
  return { ...(action && { action }), ...(integrationId && { integrationId }) };
}

async function findAll(page, pageSize, action, integrationId, scope = {}) {
  return prisma.auditEvent.findMany({
    where: { ...whereFor(action, integrationId), ...scope },
    select: {
      id: true, action: true, integrationId: true, executionId: true,
      status: true, httpStatus: true, durationMs: true, createdAt: true,
      integration: { select: { id: true, name: true, ownerId: true,
        owner: { select: { id: true, email: true } } } },
      actor: { select: { id: true, email: true } }
    },
    orderBy: { id: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize
  });
}

async function countAll(action, integrationId, scope = {}) {
  return prisma.auditEvent.count({ where: { ...whereFor(action, integrationId), ...scope } });
}

module.exports = { findAll, countAll };
