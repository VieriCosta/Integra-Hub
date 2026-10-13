const crypto = require("node:crypto");
const { promisify } = require("node:util");
const prisma = require("../config/prisma");
const { AppError } = require("../utils/AppError");

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "ih_session";

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role, isActive: user.isActive };
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("Informe um e-mail válido.", 400);
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128 || value.includes("\0")) {
    throw new AppError("A senha deve ter entre 12 e 128 caracteres.", 400);
  }
  return value;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, salt, expectedHex] = String(encoded).split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || expectedHex.length !== 128) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function readToken(req) {
  const header = req.headers.cookie || "";
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return null;
  const token = pair.slice(COOKIE_NAME.length + 1);
  return /^[A-Za-z0-9_-]{40,60}$/.test(token) ? token : null;
}

function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MS, path: "/api"
  });
}

function clearCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api"
  });
}

async function createSession(user, res) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.authSession.create({
    data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_MS) }
  });
  setCookie(res, token);
  return publicUser(user);
}

async function setupRequired() {
  return (await prisma.user.count()) === 0;
}

async function setupAdmin(req, res) {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) {
    throw new AppError("Configuração inicial permitida apenas neste computador.", 403);
  }
  const email = normalizeEmail(req.body.email);
  const passwordHash = await hashPassword(validatePassword(req.body.password));
  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      if (await tx.user.count()) throw new AppError("Administrador já configurado.", 409);
      return tx.user.create({ data: { email, passwordHash, role: "ADMIN" } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error.code === "P2034") throw new AppError("Administrador já configurado.", 409);
    throw error;
  }
  return createSession(user, res);
}

async function login(emailValue, passwordValue, req, res) {
  const email = normalizeEmail(emailValue);
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && user.isActive && await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError("E-mail ou senha inválidos.", 401);
  }
  return createSession(user, res);
}

async function authenticate(req) {
  const token = readToken(req);
  if (!token) throw new AppError("Faça login para continuar.", 401);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(token) }, include: { user: true }
  });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now || !session.user.isActive) {
    throw new AppError("Sessão inválida ou expirada.", 401);
  }
  if (now - session.lastSeenAt > 60 * 1000) {
    await prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return { user: publicUser(session.user), sessionId: session.id };
}

async function logout(sessionId, res) {
  await prisma.authSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  clearCookie(res);
}

async function changePassword(userId, currentPasswordValue, newPasswordValue, res) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const currentPassword = typeof currentPasswordValue === "string" ? currentPasswordValue : "";
  if (!user || !await verifyPassword(currentPassword, user.passwordHash)) {
    throw new AppError("Senha atual incorreta.", 400);
  }
  const newPassword = validatePassword(newPasswordValue);
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new AppError("Escolha uma senha diferente da atual.", 400);
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.authSession.updateMany({
      where: { userId, revokedAt: null }, data: { revokedAt: new Date() }
    })
  ]);
  clearCookie(res);
}

async function cleanupExpiredSessions() {
  return prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

module.exports = {
  publicUser, normalizeEmail, validatePassword, hashPassword,
  setupRequired, setupAdmin, login, authenticate, logout, changePassword,
  cleanupExpiredSessions
};
