const { AppError } = require("./AppError");

function parseOwnerFilter(user, value) {
  if (value === undefined || value === null || value === "") {
    return user.role === "ADMIN" ? null : user.id;
  }
  const ownerId = Number(value);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
    throw new AppError("Usuário inválido.", 400);
  }
  if (user.role !== "ADMIN" && ownerId !== user.id) {
    throw new AppError("Acesso não autorizado a este usuário.", 403);
  }
  return ownerId;
}

function ownerWhere(user, ownerIdValue) {
  const ownerId = parseOwnerFilter(user, ownerIdValue);
  return ownerId === null ? {} : { ownerId };
}

function executionOwnerWhere(user, ownerIdValue) {
  const ownerId = parseOwnerFilter(user, ownerIdValue);
  return ownerId === null ? {} : { integration: { is: { ownerId } } };
}

module.exports = { parseOwnerFilter, ownerWhere, executionOwnerWhere };
