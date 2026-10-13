const activityView = document.body.dataset.view;
const isLogsView = activityView === "logs";
const activityBody = document.getElementById("activity-table-body");
const integrationFilter = document.getElementById("integration-filter");
const statusFilter = document.getElementById("status-filter");
const detailsModal = new bootstrap.Modal(document.getElementById("details-modal"));
const selectedOwnerId = new URLSearchParams(location.search).get("ownerId") || "";
let activityPage = 1;
let activityRequest = 0;
const comparedExecutions = new Set();
const tools = document.createElement('div');
tools.className = 'd-flex flex-wrap gap-3 mb-3';
for (const [id, text] of [['date-from', 'De'], ['date-to', 'Até']]) {
  const label = document.createElement('label'); label.textContent = text;
  const input = document.createElement('input'); input.type = 'datetime-local'; input.id = id; input.className = 'form-control';
  input.addEventListener('change', () => { activityPage = 1; loadActivity(); }); label.append(input); tools.append(label);
}
const compareButton = document.createElement('button');
compareButton.type = 'button'; compareButton.className = 'btn btn-outline-primary align-self-end'; compareButton.textContent = 'Comparar 2 execuções'; compareButton.disabled = true;
tools.append(compareButton);
activityBody.closest('.table-responsive').before(tools);
compareButton.addEventListener('click', async () => {
  try {
    const executions = await Promise.all([...comparedExecutions].map(id => buscarExecucao(id)));
    const [before, after] = executions.map(result => result.data).sort((a, b) => a.id - b.id);
    if (before.integrationId !== after.integrationId) throw new Error('Selecione duas execuções da mesma integração.');
    const content = document.createElement('div');
    const summary = document.createElement('p'); summary.textContent = `#${before.id} → #${after.id} · HTTP ${before.httpStatus ?? '—'} → ${after.httpStatus ?? '—'} · Duração ${before.durationMs ?? '—'} → ${after.durationMs ?? '—'} ms`;
    content.append(summary);
    const differences = responseDifferences(before.responseBody, after.responseBody);
    const pre = document.createElement('pre'); pre.className = 'json-preview';
    pre.textContent = differences.length ? differences.map(diff => `${diff.path}\nAntes: ${JSON.stringify(diff.before) ?? '(ausente)'}\nDepois: ${JSON.stringify(diff.after) ?? '(ausente)'}`).join('\n\n') : 'Respostas idênticas.';
    content.append(pre); document.getElementById('details-content').replaceChildren(content); detailsModal.show();
  } catch (error) { activityMessage(error.message, true); }
});

if (statusFilter) {
  const initialStatus = new URLSearchParams(location.search).get("status");
  if (["SUCCESS", "ERROR", "RUNNING", "PENDING"].includes(initialStatus)) statusFilter.value = initialStatus;
}

function activityDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function activityCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value === null || value === undefined || value === "" ? "–" : String(value);
  if (className) cell.className = className;
  row.append(cell);
  return cell;
}

function activityMessage(message, error = false) {
  const target = document.getElementById("page-alert");
  target.textContent = message;
  target.className = error ? "alert alert-danger" : "";
}

function activityStatus(online) {
  const element = document.getElementById("api-status");
  element.classList.toggle("online", online);
  element.classList.toggle("offline", !online);
  element.querySelector("span:last-child").textContent = online ? "API Online" : "API Offline";
}

function emptyActivity(message) {
  const row = document.createElement("tr");
  const cell = activityCell(row, message, "text-center text-muted py-4");
  cell.colSpan = 6;
  activityBody.replaceChildren(row);
}

function detailField(list, label, value, json = false) {
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  if (json) {
    const pre = document.createElement("pre");
    pre.className = "json-preview";
    pre.textContent = value === null || value === undefined ? "–" : JSON.stringify(value, null, 2);
    description.append(pre);
  } else {
    description.textContent = value === null || value === undefined || value === "" ? "–" : String(value);
  }
  list.append(term, description);
}

async function showActivityDetails(id) {
  activityMessage("");
  try {
    const { data } = await buscarExecucao(id);
    const list = document.createElement("dl");
    list.className = "details-grid";
    detailField(list, "Integração", data.integration?.name);
    detailField(list, "Status", data.status);
    detailField(list, "HTTP", data.httpStatus);
    detailField(list, "Início", activityDate(data.startedAt));
    detailField(list, "Fim", activityDate(data.finishedAt));
    detailField(list, "Duração", data.durationMs === null ? null : `${data.durationMs} ms`);
    detailField(list, "URL", data.requestUrl);
    detailField(list, "Método", data.requestMethod);
    detailField(list, "Headers", data.requestHeaders, true);
    detailField(list, "Parâmetros", data.requestQueryParams, true);
    detailField(list, "Body enviado", data.requestBody, true);
    detailField(list, "Response", data.responseBody, true);
    detailField(list, "Erro", data.errorMessage);
    document.getElementById("details-content").replaceChildren(list);
    detailsModal.show();
  } catch (error) {
    activityMessage(error.message, true);
  }
}

function renderActivity(result) {
  const items = result.items || [];
  activityBody.replaceChildren();
  if (!items.length) emptyActivity(isLogsView ? "Nenhum erro encontrado." : "Nenhuma execução encontrada.");
  for (const item of items) {
    const row = document.createElement("tr");
    activityCell(row, activityDate(item.startedAt || item.createdAt));
    activityCell(row, item.integration?.owner?.email ? `${item.integration.name} · ${item.integration.owner.email}` : item.integration?.name);
    if (!isLogsView) activityCell(row, item.status);
    activityCell(row, item.httpStatus);
    if (isLogsView) activityCell(row, item.errorMessage, "text-break");
    activityCell(row, item.durationMs === null ? null : `${item.durationMs} ms`);
    const action = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm btn-outline-primary";
    button.textContent = "Detalhes";
    button.addEventListener("click", () => showActivityDetails(item.id));
    action.append(button);
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'form-check-input ms-2'; check.setAttribute('aria-label', `Comparar execução ${item.id}`); check.checked = comparedExecutions.has(item.id);
    check.addEventListener('change', () => {
      if (check.checked && comparedExecutions.size >= 2) { check.checked = false; activityMessage('Selecione no máximo duas execuções.', true); return; }
      if (check.checked) comparedExecutions.add(item.id); else comparedExecutions.delete(item.id);
      compareButton.disabled = comparedExecutions.size !== 2;
    }); action.append(check);
    row.append(action);
    activityBody.append(row);
  }
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  document.getElementById("result-count").textContent = `${result.total} registro(s)`;
  document.getElementById("page-label").textContent = `Página ${result.page} de ${pages}`;
  document.getElementById("previous-page").disabled = activityPage <= 1;
  document.getElementById("next-page").disabled = activityPage >= pages;
}

async function loadActivity() {
  const currentRequest = ++activityRequest;
  activityMessage("");
  emptyActivity("Carregando...");
  try {
    const { data } = await listarExecucoes({
      page: activityPage,
      status: isLogsView ? "ERROR" : statusFilter.value,
      integrationId: integrationFilter.value,
      ownerId: selectedOwnerId,
      from: document.getElementById('date-from').value ? new Date(document.getElementById('date-from').value).toISOString() : '',
      to: document.getElementById('date-to').value ? new Date(document.getElementById('date-to').value).toISOString() : ''
    });
    if (currentRequest === activityRequest) renderActivity(data);
  } catch (error) {
    if (currentRequest === activityRequest) {
      emptyActivity("Não foi possível carregar os registros.");
      activityMessage(error.message, true);
    }
  }
}

async function loadActivityIntegrations() {
  try {
    const { data } = await listarIntegracoes(selectedOwnerId);
    for (const integration of data) {
      const option = document.createElement("option");
      option.value = integration.id;
      option.textContent = integration.name;
      integrationFilter.append(option);
    }
  } catch (error) {
    activityMessage(`Filtro de integrações indisponível: ${error.message}`, true);
  }
}

integrationFilter.addEventListener("change", () => { activityPage = 1; loadActivity(); });
statusFilter?.addEventListener("change", () => { activityPage = 1; loadActivity(); });
document.getElementById("refresh-button").addEventListener("click", loadActivity);
document.getElementById("previous-page").addEventListener("click", () => { if (activityPage > 1) { activityPage--; loadActivity(); } });
document.getElementById("next-page").addEventListener("click", () => { activityPage++; loadActivity(); });

sessionReady.then(() => {
  verificarApi().then(() => activityStatus(true)).catch(() => activityStatus(false));
  loadActivityIntegrations();
  loadActivity();
  const executionId = new URLSearchParams(location.search).get('executionId');
  if (executionId && /^\d+$/.test(executionId)) showActivityDetails(executionId);
}).catch(() => {});
