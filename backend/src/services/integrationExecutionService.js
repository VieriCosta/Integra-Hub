const integrationRepository = require("../repositories/integrationRepository");
const executionRepository = require("../repositories/integrationExecutionRepository");
const { AppError } = require("../utils/AppError");
const { sanitizeExecution } = require("../utils/headerMasker");
const { validateDestinationUrl } = require("../utils/urlValidator");
const { parsePagination } = require("../utils/pagination");
const { ownerWhere, executionOwnerWhere } = require("../utils/accessScope");

const EXECUTION_STATUSES = new Set(["PENDING", "RUNNING", "SUCCESS", "ERROR"]);

function parseId(id) {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new AppError("Identificador inválido.", 400);
  }

  return parsedId;
}

async function executeIntegration(id, user) {
  const integrationId = parseId(id);
  const integration = await integrationRepository.findById(integrationId, ownerWhere(user));

  if (!integration) {
    throw new AppError("Integração não encontrada.", 404);
  }

  if (integration.status !== "ACTIVE") {
    throw new AppError("Integração inativa não pode ser executada.", 400);
  }

  const { request } = await require('./environmentService').resolveIntegration(integration);
  if (!validateDestinationUrl(request.baseUrl)) {
    throw new AppError("A URL da integração é inválida. Use apenas http:// ou https://.", 400);
  }

  const { enqueue, startWorker } = require('./queueService');
  const queued = await require('../config/prisma').$transaction(tx => enqueue(integration, user.id, tx));
  startWorker();
  return sanitizeExecution(queued);
}

async function listExecutionsByIntegration(id, pageValue = 1, pageSizeValue = 20, user) {
  const integrationId = parseId(id);
  const { page, pageSize } = parsePagination(pageValue, pageSizeValue);
  const integration = await integrationRepository.findById(integrationId, ownerWhere(user));

  if (!integration) {
    throw new AppError("Integração não encontrada.", 404);
  }

  const [items, total] = await Promise.all([
    executionRepository.findByIntegrationId(integrationId, page, pageSize),
    executionRepository.countByIntegrationId(integrationId)
  ]);
  return { items, total, page, pageSize };
}

async function listExecutions(pageValue = 1, pageSizeValue = 20, statusValue, integrationIdValue, user, ownerIdValue, from, to) {
  const { page, pageSize } = parsePagination(pageValue, pageSizeValue);
  const status = statusValue ? String(statusValue).toUpperCase() : null;
  if (status && !EXECUTION_STATUSES.has(status)) {
    throw new AppError("Status de execução inválido.", 400);
  }
  const integrationId = integrationIdValue ? parseId(integrationIdValue) : null;
  const scope = { ...executionOwnerWhere(user, ownerIdValue), ...require('../utils/dateRange').dateRange(from, to) };
  const [items, total] = await Promise.all([
    executionRepository.findAll(page, pageSize, status, integrationId, scope),
    executionRepository.countAll(status, integrationId, scope)
  ]);
  return { items, total, page, pageSize };
}

async function recoverStaleExecutions() {
  const finishedAt = new Date();
  const before = new Date(finishedAt.getTime() - 120000);
  return executionRepository.recoverStaleRunning(before, finishedAt);
}

async function getExecutionById(id, user) {
  const execution = await executionRepository.findById(parseId(id), executionOwnerWhere(user));

  if (!execution) {
    throw new AppError("Execução não encontrada.", 404);
  }

  return sanitizeExecution(execution);
}

module.exports = {
  executeIntegration,
  listExecutionsByIntegration,
  listExecutions,
  getExecutionById,
  recoverStaleExecutions
};
