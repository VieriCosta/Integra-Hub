const prisma = require("../config/prisma");
const { AppError } = require("../utils/AppError");
const { parsePagination } = require("../utils/pagination");
const { normalizeEmail, validatePassword, hashPassword, publicUser } = require("./authService");

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError("Usuário inválido.", 400);
  return id;
}

async function onlineSessions() {
  const now = new Date();
  const since = new Date(now.getTime() - 15 * 60 * 1000);
  const sessions = await prisma.authSession.findMany({
    where: {
      revokedAt: null, expiresAt: { gt: now },
      user: { is: { isActive: true } }
    },
    select: { userId: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" }
  });
  const latestByUser = new Map();
  const loggedInUserIds = new Set();
  for (const session of sessions) {
    loggedInUserIds.add(session.userId);
    if (!latestByUser.has(session.userId)) latestByUser.set(session.userId, session.lastSeenAt);
  }
  return {
    openSessions: sessions.length,
    loggedInUsers: loggedInUserIds.size,
    onlineUsers: [...latestByUser.values()].filter((lastSeenAt) => lastSeenAt >= since).length,
    latestByUser
  };
}

async function listUsers(pageValue, pageSizeValue) {
  const { page, pageSize } = parsePagination(pageValue, pageSizeValue);
  const [users, total, online, totalIntegrations, totalExecutions] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, email: true, role: true, isActive: true, createdAt: true,
        _count: { select: { integrations: true } }
      },
      orderBy: { id: "asc" }, skip: (page - 1) * pageSize, take: pageSize
    }),
    prisma.user.count(), onlineSessions(), prisma.integration.count(), prisma.integrationExecution.count()
  ]);
  const items = await Promise.all(users.map(async (user) => ({
    id: user.id, email: user.email, role: user.role, isActive: user.isActive,
    createdAt: user.createdAt, integrationCount: user._count.integrations,
    executionCount: await prisma.integrationExecution.count({
      where: { integration: { is: { ownerId: user.id } } }
    }),
    loggedIn: online.latestByUser.has(user.id),
    online: Boolean(online.latestByUser.get(user.id) >= new Date(Date.now() - 15 * 60 * 1000)),
    lastSeenAt: online.latestByUser.get(user.id) || null
  })));
  return {
    items, total, page, pageSize,
    summary: {
      totalUsers: total, onlineUsers: online.onlineUsers,
      loggedInUsers: online.loggedInUsers, openSessions: online.openSessions,
      totalIntegrations, totalExecutions
    }
  };
}

async function createUser(payload) {
  const email = normalizeEmail(payload.email);
  const passwordHash = await hashPassword(validatePassword(payload.password));
  if (payload.role !== undefined && !["ADMIN", "USER"].includes(payload.role)) {
    throw new AppError("Perfil inválido.", 400);
  }
  const role = payload.role === "ADMIN" ? "ADMIN" : "USER";
  try {
    const user = await prisma.user.create({ data: { email, passwordHash, role } });
    return publicUser(user);
  } catch (error) {
    if (error.code === "P2002") throw new AppError("Este e-mail já está cadastrado.", 409);
    throw error;
  }
}

async function updateUser(idValue, payload, actorId) {
  const id = parseId(idValue);
  if (id === actorId) throw new AppError("Altere sua própria conta por outro administrador.", 400);
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new AppError("Usuário não encontrado.", 404);
  const data = {};
  if (payload.role !== undefined) {
    if (!["ADMIN", "USER"].includes(payload.role)) throw new AppError("Perfil inválido.", 400);
    data.role = payload.role;
  }
  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== "boolean") throw new AppError("Status inválido.", 400);
    data.isActive = payload.isActive;
  }
  if (!Object.keys(data).length) throw new AppError("Informe perfil ou status.", 400);
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data });
    if (data.isActive === false || (data.role && data.role !== current.role)) {
      await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return updated;
  });
  return publicUser(user);
}

async function resetPassword(idValue, passwordValue) {
  const id = parseId(idValue);
  if (!await prisma.user.findUnique({ where: { id }, select: { id: true } })) {
    throw new AppError("Usuário não encontrado.", 404);
  }
  const passwordHash = await hashPassword(validatePassword(passwordValue));
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);
}

module.exports = { listUsers, createUser, updateUser, resetPassword };
