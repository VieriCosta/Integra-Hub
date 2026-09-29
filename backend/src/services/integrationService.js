const integrationRepository = require("../repositories/integrationRepository");
const { AppError } = require("../utils/AppError");
const { validateDestinationUrl } = require("../utils/urlValidator");
const { REDACTED, preserveRedacted, sanitizeIntegration } = require("../utils/headerMasker");
const { ownerWhere } = require("../utils/accessScope");
const prisma = require("../config/prisma");

const ALLOWED_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const ALLOWED_INTEGRATION_STATUS = ["ACTIVE", "INACTIVE"];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMethod(method) {
  return normalizeText(method).toUpperCase();
}

function parseId(id) {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new AppError("Identificador inválido.", 400);
  }

  return parsedId;
}

function normalizeJsonObject(value, fieldName, allowNull = true) {
  if (value === undefined || value === null || value === "") {
    return allowNull ? null : {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(`${fieldName} deve ser um objeto JSON válido.`, 400);
  }

  return value;
}

function validateIntegrationPayload(payload) {
  const name = normalizeText(payload.name);
  const description = normalizeText(payload.description);
  const baseUrl = normalizeText(payload.baseUrl);
  const method = normalizeMethod(payload.method);
  const headers = normalizeJsonObject(payload.headers, "Headers");
  const queryParams = normalizeJsonObject(payload.queryParams, "Query Params");
  const body = normalizeJsonObject(payload.body, "Body");
  const status = normalizeText(payload.status || "ACTIVE").toUpperCase();

  if (!name) {
    throw new AppError("O nome da integração é obrigatório.", 400);
  }

  if (!baseUrl) {
    throw new AppError("A URL da integração é obrigatória.", 400);
  }

  if (!validateDestinationUrl(baseUrl)) {
    throw new AppError("A URL da integração é inválida. Use apenas http:// ou https://.", 400);
  }

  if (!method) {
    throw new AppError("O método HTTP é obrigatório.", 400);
  }

  if (!ALLOWED_HTTP_METHODS.includes(method)) {
    throw new AppError("Método HTTP inválido.", 400);
  }

  if (!ALLOWED_INTEGRATION_STATUS.includes(status)) {
    throw new AppError("Status da integração inválido.", 400);
  }

  return {
    name,
    description: description || null,
    baseUrl,
    method,
    headers,
    queryParams,
    body,
    status
  };
}

async function listIntegrations(user, ownerIdValue) {
  return (await integrationRepository.findAll(ownerWhere(user, ownerIdValue))).map(sanitizeIntegration);
}

async function getIntegrationById(id, user) {
  const integration = await integrationRepository.findById(parseId(id), ownerWhere(user));

  if (!integration) {
    throw new AppError("Integração não encontrada.", 404);
  }

  return sanitizeIntegration(integration);
}

async function createIntegration(payload, user) {
  let ownerId = user.id;
  if (user.role === "ADMIN" && payload.ownerId !== undefined && payload.ownerId !== "") {
    ownerId = Number(payload.ownerId);
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0 ||
        !await prisma.user.findFirst({ where: { id: ownerId, isActive: true }, select: { id: true } })) {
      throw new AppError("Proprietário inválido ou inativo.", 400);
    }
  }
  const data = { ...validateIntegrationPayload(payload), ownerId };
  return sanitizeIntegration(await integrationRepository.create(data, user.id));
}

async function updateIntegration(id, payload, user) {
  const integrationId = parseId(id);
  const previous = await integrationRepository.findById(integrationId, ownerWhere(user));
  if (!previous) throw new AppError("Integração não encontrada.", 404);
  const merged = {
    ...payload,
    baseUrl: payload.baseUrl === sanitizeIntegration(previous).baseUrl ? previous.baseUrl : payload.baseUrl,
    headers: preserveRedacted(payload.headers, previous.headers),
    queryParams: preserveRedacted(payload.queryParams, previous.queryParams),
    body: preserveRedacted(payload.body, previous.body)
  };
  if (merged.baseUrl && merged.baseUrl.includes(REDACTED)) {
    throw new AppError("Informe a URL completa ao alterá-la.", 400);
  }
  const data = validateIntegrationPayload(merged);
  return sanitizeIntegration(await integrationRepository.update(integrationId, data, user.id));
}

module.exports = {
  listIntegrations,
  getIntegrationById,
  createIntegration,
  updateIntegration
};
