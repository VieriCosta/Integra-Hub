const auditBody = document.getElementById("audit-table-body");
const auditIntegrationFilter = document.getElementById("integration-filter");
const auditActionFilter = document.getElementById("action-filter");
const selectedOwnerId = new URLSearchParams(location.search).get("ownerId") || "";
let auditPage = 1;
let auditRequest = 0;

const actionLabels = {
  INTEGRATION_EXISTING: "Integração já existente",
  EXECUTION_EXISTING: "Execução já existente",
  INTEGRATION_CREATED: "Integração cadastrada",
  INTEGRATION_UPDATED: "Integração editada",
  EXECUTION_STARTED: "Execução iniciada",
  EXECUTION_FINISHED: "Execução finalizada",
  EXECUTION_RECOVERED: "Execução recuperada"
};

function auditDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function auditCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value === null || value === undefined || value === "" ? "–" : String(value);
  row.append(cell);
  return cell;
}

function auditMessage(message, error = false) {
  const target = document.getElementById("page-alert");
  target.textContent = message;
  target.className = error ? "alert alert-danger" : "";
}

function emptyAudit(message) {
  const row = document.createElement("tr");
  auditCell(row, message).colSpan = 8;
  row.firstChild.className = "text-center text-muted py-4";
  auditBody.replaceChildren(row);
}

function renderAudit(result) {
  auditBody.replaceChildren();
  if (!result.items.length) emptyAudit("Nenhum evento encontrado.");
  for (const item of result.items) {
    const row = document.createElement("tr");
    auditCell(row, auditDate(item.createdAt));
    auditCell(row, actionLabels[item.action] || item.action);
    auditCell(row, item.actor?.email || "Sistema/legado");
    auditCell(row, item.integration?.owner?.email ? `${item.integration.name} · ${item.integration.owner.email}` : item.integration?.name);
    auditCell(row, item.executionId ? `#${item.executionId}` : null);
    auditCell(row, item.status);
    auditCell(row, item.httpStatus);
    auditCell(row, item.durationMs === null ? null : `${item.durationMs} ms`);
    auditBody.append(row);
  }
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  document.getElementById("result-count").textContent = `${result.total} evento(s)`;
  document.getElementById("page-label").textContent = `Página ${result.page} de ${pages}`;
  document.getElementById("previous-page").disabled = auditPage <= 1;
  document.getElementById("next-page").disabled = auditPage >= pages;
}

async function loadAudit() {
  const currentRequest = ++auditRequest;
  auditMessage("");
  emptyAudit("Carregando...");
  try {
    const { data } = await listarAuditoria({
      page: auditPage, action: auditActionFilter.value,
      integrationId: auditIntegrationFilter.value, ownerId: selectedOwnerId
    });
    if (currentRequest === auditRequest) renderAudit(data);
  } catch (error) {
    if (currentRequest === auditRequest) {
      emptyAudit("Não foi possível carregar a auditoria.");
      auditMessage(error.message, true);
    }
  }
}

async function loadAuditIntegrations() {
  try {
    const { data } = await listarIntegracoes(selectedOwnerId);
    for (const integration of data) {
      const option = document.createElement("option");
      option.value = integration.id;
      option.textContent = integration.name;
      auditIntegrationFilter.append(option);
    }
  } catch (error) {
    auditMessage(`Filtro de integrações indisponível: ${error.message}`, true);
  }
}

auditIntegrationFilter.addEventListener("change", () => { auditPage = 1; loadAudit(); });
auditActionFilter.addEventListener("change", () => { auditPage = 1; loadAudit(); });
document.getElementById("refresh-button").addEventListener("click", loadAudit);
document.getElementById("previous-page").addEventListener("click", () => { if (auditPage > 1) { auditPage--; loadAudit(); } });
document.getElementById("next-page").addEventListener("click", () => { auditPage++; loadAudit(); });

sessionReady.then(() => {
  verificarApi().then(() => {
  const status = document.getElementById("api-status");
  status.classList.replace("offline", "online");
  status.querySelector("span:last-child").textContent = "API Online";
}).catch(() => {
  document.getElementById("api-status").querySelector("span:last-child").textContent = "API Offline";
});
  loadAuditIntegrations();
  loadAudit();
}).catch(() => {});
