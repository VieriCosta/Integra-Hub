const prisma = require("../config/prisma");

async function findAll(where = {}) {
  return prisma.integration.findMany({
    where,
    include: { owner: { select: { id: true, email: true } } },
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function findById(id, where = {}) {
  return prisma.integration.findFirst({
    where: { id, ...where },
    include: { owner: { select: { id: true, email: true } } }
  });
}

async function create(data, actorId) {
  return prisma.$transaction(async (tx) => {
    const integration = await tx.integration.create({
      data, include: { owner: { select: { id: true, email: true } } }
    });
    await tx.auditEvent.create({
      data: { action: "INTEGRATION_CREATED", integrationId: integration.id, actorId }
    });
    return integration;
  });
}

async function update(id, data, actorId) {
  return prisma.$transaction(async (tx) => {
    const integration = await tx.integration.update({
      where: { id }, data, include: { owner: { select: { id: true, email: true } } }
    });
    await tx.auditEvent.create({
      data: { action: "INTEGRATION_UPDATED", integrationId: id, actorId }
    });
    return integration;
  });
}

module.exports = {
  findAll,
  findById,
  create,
  update
};
