const auditRepository = require("../repositories/auditRepository");
const { parsePagination } = require("../utils/pagination");
const { AppError } = require("../utils/AppError");
const { executionOwnerWhere } = require("../utils/accessScope");

const ACTIONS = new Set([
  "INTEGRATION_EXISTING", "EXECUTION_EXISTING",
  "INTEGRATION_CREATED", "INTEGRATION_UPDATED",
  "EXECUTION_STARTED", "EXECUTION_FINISHED", "EXECUTION_RECOVERED"
]);

async function listAuditEvents(pageValue, pageSizeValue, actionValue, integrationIdValue, user, ownerIdValue) {
  const { page, pageSize } = parsePagination(pageValue, pageSizeValue);
  const action = actionValue ? String(actionValue).toUpperCase() : null;
  if (action && !ACTIONS.has(action)) throw new AppError("Ação de auditoria inválida.", 400);
  const integrationId = integrationIdValue ? Number(integrationIdValue) : null;
  if (integrationIdValue && (!Number.isSafeInteger(integrationId) || integrationId <= 0)) {
    throw new AppError("Identificador inválido.", 400);
  }
  const scope = executionOwnerWhere(user, ownerIdValue);
  const [items, total] = await Promise.all([
    auditRepository.findAll(page, pageSize, action, integrationId, scope),
    auditRepository.countAll(action, integrationId, scope)
  ]);
  return { items, total, page, pageSize };
}

module.exports = { listAuditEvents };
