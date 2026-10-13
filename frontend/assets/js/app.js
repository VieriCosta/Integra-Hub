$(function () {
  const $apiStatus = $("#api-status");
  const $tableBody = $("#integrations-table-body");
  const $historyTableBody = $("#history-table-body");
  const integrationModal = new bootstrap.Modal(document.getElementById("integrationModal"));
  const executeModal = new bootstrap.Modal(document.getElementById("executeModal"));
  const resultModal = new bootstrap.Modal(document.getElementById("resultModal"));
  const historyModal = new bootstrap.Modal(document.getElementById("historyModal"));

  let integrations = [];
  let currentIntegrationId = null;
  let integrationToExecute = null;
  let historyIntegrationId = null;
  let historyPage = 1;
  const selectedOwnerId = new URLSearchParams(location.search).get("ownerId") || "";

  function escapeHtml(value) {
    return $("<div>").text(value === null || value === undefined ? "" : value).html();
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  }

  function formatJson(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return JSON.stringify(value, null, 2);
  }

  function jsonBlock(value) {
    return `<pre class="json-preview">${escapeHtml(formatJson(value))}</pre>`;
  }

  function showAlert(target, message, type = "success") {
    const alertHtml = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
      </div>
    `;

    $(target).html(alertHtml);
  }

  function setApiStatus(isOnline) {
    $apiStatus.toggleClass("online", isOnline);
    $apiStatus.toggleClass("offline", !isOnline);
    $apiStatus.find("span:last").text(isOnline ? "API Online" : "API Offline");
  }

  function methodBadge(method) {
    const normalizedMethod = String(method || "").toLowerCase();
    return `<span class="badge badge-method ${normalizedMethod}">${escapeHtml(method)}</span>`;
  }

  function statusBadge(status) {
    const normalizedStatus = String(status || "").toLowerCase();
    return `<span class="badge status-badge ${normalizedStatus}">${escapeHtml(status)}</span>`;
  }

  function executionStatusBadge(status) {
    const normalizedStatus = String(status || "").toLowerCase();
    return `<span class="badge execution-badge ${normalizedStatus}">${escapeHtml(status)}</span>`;
  }

  function emptyRow(message, colspan = 7) {
    return `<tr><td colspan="${colspan}" class="text-center text-muted py-4">${escapeHtml(message)}</td></tr>`;
  }

  function parseJsonField(selector, label, emptyValue) {
    const rawValue = $(selector).val().trim();

    if (!rawValue) {
      return emptyValue;
    }

    try {
      const parsedValue = JSON.parse(rawValue);

      if (parsedValue === null || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
        throw new Error();
      }

      return parsedValue;
    } catch (error) {
      throw new Error(`O JSON informado em ${label} é inválido.`);
    }
  }

  function updateBodyAvailability() {
    const isGet = $("#method").val() === "GET";
    $("#body").prop("disabled", isGet);
  }

  function fillJsonTextarea(selector, value) {
    $(selector).val(value ? JSON.stringify(value, null, 2) : "");
  }

  function resetIntegrationForm() {
    currentIntegrationId = null;
    $("#integrationModalLabel").text("Nova integração");
    $("#integration-form")[0].reset();
    document.querySelectorAll('.json-field').forEach(field => { field.setCustomValidity(''); field.classList.remove('is-invalid'); });
    $("#status").val("ACTIVE");
    $("#modal-alert-container").empty();
    updateBodyAvailability();
  }

  function getFormData() {
    return {
      name: $("#name").val(),
      description: $("#description").val(),
      baseUrl: $("#baseUrl").val(),
      method: $("#method").val(),
      status: $("#status").val(),
      environmentId: $('#environment-id').val() ? Number($('#environment-id').val()) : null,
      ...(window.currentUser?.role === "ADMIN" && selectedOwnerId ? { ownerId: selectedOwnerId } : {}),
      headers: parseJsonField("#headers", "Headers", null),
      queryParams: parseJsonField("#queryParams", "Query Params", null),
      body: $("#method").val() === "GET" ? null : parseJsonField("#body", "Body", null)
    };
  }

  function renderIntegrations() {
    if (!integrations.length) {
      $tableBody.html(emptyRow("Nenhuma integração cadastrada."));
      return;
    }

    const search = $('#integration-search').val().toLowerCase();
    const visible = integrations.filter(item => `${item.name} ${item.baseUrl}`.toLowerCase().includes(search) && (!$('#method-filter').val() || item.method === $('#method-filter').val()) && (!$('#integration-status-filter').val() || item.status === $('#integration-status-filter').val()));
    if (!visible.length) { $tableBody.html(emptyRow('Nenhuma integração corresponde aos filtros.')); return; }
    const rows = visible.map((integration) => `
      <tr>
        <td>${escapeHtml(integration.name)}</td>
        <td>${methodBadge(integration.method)}</td>
        <td class="url-cell" title="${escapeAttribute(integration.baseUrl)}">${escapeHtml(integration.baseUrl)}</td>
        <td>${escapeHtml(integration.owner?.email || "Legado")}</td>
        <td>${statusBadge(integration.status)}</td>
        <td>${integration.executions?.[0] ? `${executionStatusBadge(integration.executions[0].status)}<br>${formatDate(integration.executions[0].createdAt)}<br>${integration.executions[0].durationMs ?? '—'} ms` : 'Nunca executada'}</td>
        <td class="text-end action-cell">
          <button class="btn btn-sm btn-outline-secondary js-view" type="button" data-id="${integration.id}">Visualizar</button>
          <button class="btn btn-sm btn-outline-primary js-edit" type="button" data-id="${integration.id}">Editar</button>
          <button class="btn btn-sm btn-outline-secondary js-duplicate" type="button" data-id="${integration.id}">Duplicar</button>
          <button class="btn btn-sm btn-success js-execute" type="button" data-id="${integration.id}" ${integration.status !== "ACTIVE" ? "disabled" : ""}>Executar</button>
          <button class="btn btn-sm btn-outline-dark js-history" type="button" data-id="${integration.id}">Histórico</button>
        </td>
      </tr>
    `);

    $tableBody.html(rows.join(""));
  }

  function renderResultModal(execution) {
    const title = execution.status === "SUCCESS" ? "Integração executada com sucesso" : "Falha na execução";
    const alertType = execution.status === "SUCCESS" ? "success" : "danger";

    $("#resultModalLabel").text(title);
    $("#result-summary-content").html(`
      <div class="alert alert-${alertType}">
        <strong>${escapeHtml(title)}</strong>
        <div>HTTP: ${escapeHtml(execution.httpStatus || "-")}</div>
        <div>Tempo: ${escapeHtml(execution.durationMs || 0)} ms</div>
      </div>
      <dl class="details-grid">
        <dt>Integração</dt><dd>${escapeHtml(execution.integration ? execution.integration.name : "-")}</dd>
        <dt>Status</dt><dd>${executionStatusBadge(execution.status)}</dd>
        <dt>HTTP Status</dt><dd>${escapeHtml(execution.httpStatus || "-")}</dd>
        <dt>Duração</dt><dd>${escapeHtml(execution.durationMs || 0)} ms</dd>
        <dt>Data/Hora</dt><dd>${formatDate(execution.startedAt || execution.createdAt)}</dd>
      </dl>
    `);

    $("#result-request-content").html(`
      <dl class="details-grid">
        <dt>URL</dt><dd class="text-break">${escapeHtml(execution.requestUrl)}</dd>
        <dt>Método</dt><dd>${methodBadge(execution.requestMethod)}</dd>
        <dt>Headers</dt><dd>${jsonBlock(execution.requestHeaders)}</dd>
        <dt>Query Params</dt><dd>${jsonBlock(execution.requestQueryParams)}</dd>
        <dt>Body</dt><dd>${jsonBlock(execution.requestBody)}</dd>
      </dl>
    `);

    $("#result-response-content").html(`
      <dl class="details-grid">
        <dt>HTTP Status</dt><dd>${escapeHtml(execution.httpStatus || "-")}</dd>
        <dt>Response Body</dt><dd>${jsonBlock(execution.responseBody)}</dd>
        <dt>Erro</dt><dd>${escapeHtml(execution.errorMessage || "-")}</dd>
      </dl>
    `);

    resultModal.show();
  }

  function renderHistory(integration, result) {
    const executions = result.items || [];
    $("#history-integration-name").text(integration ? integration.name : "");
    const totalPages = Math.max(1, Math.ceil((result.total || 0) / (result.pageSize || 20)));
    $("#history-page-label").text(`Página ${result.page || 1} de ${totalPages}`);
    $("#history-previous").prop("disabled", historyPage <= 1);
    $("#history-next").prop("disabled", historyPage >= totalPages);

    if (!executions.length) {
      $historyTableBody.html(emptyRow("Nenhuma execução registrada.", 5));
      return;
    }

    const rows = executions.map((execution) => `
      <tr>
        <td>${formatDate(execution.startedAt || execution.createdAt)}</td>
        <td>${executionStatusBadge(execution.status)}</td>
        <td>${escapeHtml(execution.httpStatus || "-")}</td>
        <td>${escapeHtml(execution.durationMs || 0)} ms</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary js-execution-details" type="button" data-id="${execution.id}">Detalhes</button>
        </td>
      </tr>
    `);

    $historyTableBody.html(rows.join(""));
  }

  async function checkApiHealth() {
    try {
      await verificarApi();
      setApiStatus(true);
    } catch (error) {
      setApiStatus(false);
    }
  }

  async function loadIntegrations() {
    try {
      const result = await listarIntegracoes(selectedOwnerId);
      integrations = result.data || [];
      renderIntegrations();
    } catch (error) {
      integrations = [];
      $tableBody.html(emptyRow("Não foi possível carregar as integrações."));
      showAlert("#alert-container", error.message, "danger");
    }
  }

  async function openIntegrationModal(id, readOnly = false) {
    resetIntegrationForm();
    const environments = await requestJson(`/environments${selectedOwnerId ? `?ownerId=${encodeURIComponent(selectedOwnerId)}` : ''}`).catch(error => { showAlert('#modal-alert-container', error.message, 'warning'); return { data: [] }; });
    $('#environment-id').html('<option value="">Sem ambiente</option>');
    for (const env of environments.data) $('<option>').val(env.id).text(`${env.name} · ${env.stage}`).appendTo('#environment-id');

    if (id) {
      const result = await buscarIntegracao(id);
      const integration = result.data;

      currentIntegrationId = integration.id;
      $("#integrationModalLabel").text(readOnly ? "Visualizar integração" : "Editar integração");
      $("#name").val(integration.name);
      $("#description").val(integration.description || "");
      $("#baseUrl").val(integration.baseUrl);
      $("#method").val(integration.method);
      $("#status").val(integration.status);
      $('#environment-id').val(integration.environmentId || '');
      fillJsonTextarea("#headers", integration.headers);
      fillJsonTextarea("#queryParams", integration.queryParams);
      fillJsonTextarea("#body", integration.body);
      updateBodyAvailability();
    }

    $("#integration-form :input").prop("disabled", readOnly);
    updateBodyAvailability();
    if (readOnly) $('#body').prop('disabled', true);
    $("#save-integration-button").toggle(!readOnly);
    integrationModal.show();
  }

  async function saveIntegration(event) {
    event.preventDefault();

    const $saveButton = $("#save-integration-button");
    $saveButton.prop("disabled", true).text("Salvando...");
    $("#modal-alert-container").empty();

    try {
      const data = getFormData();

      if (currentIntegrationId) {
        await atualizarIntegracao(currentIntegrationId, data);
        showAlert("#alert-container", "Integração atualizada com sucesso.");
      } else {
        await criarIntegracao(data);
        showAlert("#alert-container", "Integração cadastrada com sucesso.");
      }

      integrationModal.hide();
      await loadIntegrations();
    } catch (error) {
      showAlert("#modal-alert-container", error.message, "danger");
    } finally {
      $saveButton.prop("disabled", false).text("Salvar");
    }
  }

  function findIntegration(id) {
    return integrations.find((integration) => integration.id === Number(id));
  }

  function openExecuteModal(id) {
    integrationToExecute = findIntegration(id);

    if (!integrationToExecute) {
      showAlert("#alert-container", "Integração não encontrada.", "danger");
      return;
    }

    $("#execute-name").text(integrationToExecute.name);
    $("#execute-method").html(methodBadge(integrationToExecute.method));
    $("#execute-url").text(integrationToExecute.baseUrl);
    $("#confirm-execute-button").prop("disabled", false).text("Executar");
    executeModal.show();
  }

  async function confirmExecution() {
    if (!integrationToExecute) {
      return;
    }

    const $button = $("#confirm-execute-button");
    $button.prop("disabled", true).text("Executando...");

    try {
      const result = await executarIntegracao(integrationToExecute.id);
      executeModal.hide();
      renderResultModal(result.data);
      await loadIntegrations();
    } catch (error) {
      showAlert("#alert-container", error.message, "danger");
    } finally {
      $button.prop("disabled", false).text("Executar");
    }
  }

  async function openHistoryModal(id) {
    historyIntegrationId = id;
    historyPage = 1;
    $historyTableBody.html(emptyRow("Carregando histórico...", 5));
    historyModal.show();

    await loadHistoryPage();
  }

  async function loadHistoryPage() {
    const integration = findIntegration(historyIntegrationId);

    try {
      const result = await listarExecucoesIntegracao(historyIntegrationId, historyPage);
      renderHistory(integration, result.data || {});
    } catch (error) {
      $historyTableBody.html(emptyRow("Não foi possível carregar o histórico.", 5));
      showAlert("#alert-container", error.message, "danger");
    }
  }

  async function openExecutionDetails(id) {
    try {
      const result = await buscarExecucao(id);
      renderResultModal(result.data);
    } catch (error) {
      showAlert("#alert-container", error.message, "danger");
    }
  }

  $("#new-integration-button").on("click", function () {
    openIntegrationModal(null).catch(error => showAlert('#alert-container', error.message, 'danger'));
  });

  $("#method").on("change", updateBodyAvailability);
  $('#integration-search, #method-filter, #integration-status-filter').on('input change', renderIntegrations);
  $tableBody.on('click', '.js-duplicate', async function () {
    $(this).prop('disabled', true);
    try { await requestJson(`/integrations/${$(this).data('id')}/duplicate`, { method: 'POST' }); await loadIntegrations(); showAlert('#alert-container', 'Cópia criada como inativa.'); }
    catch (error) { showAlert('#alert-container', error.message, 'danger'); $(this).prop('disabled', false); }
  });
  $("#integration-form").on("submit", saveIntegration);
  $("#confirm-execute-button").on("click", confirmExecution);

  $tableBody.on("click", ".js-view", function () {
    openIntegrationModal($(this).data("id"), true).catch(error => showAlert('#alert-container', error.message, 'danger'));
  });

  $tableBody.on("click", ".js-edit", function () {
    openIntegrationModal($(this).data("id")).catch(error => showAlert('#alert-container', error.message, 'danger'));
  });

  $tableBody.on("click", ".js-execute", function () {
    openExecuteModal($(this).data("id"));
  });

  $tableBody.on("click", ".js-history", function () {
    openHistoryModal($(this).data("id"));
  });

  $historyTableBody.on("click", ".js-execution-details", function () {
    openExecutionDetails($(this).data("id"));
  });

  $("#history-previous").on("click", function () {
    if (historyPage > 1) { historyPage--; loadHistoryPage(); }
  });
  $("#history-next").on("click", function () {
    historyPage++;
    loadHistoryPage();
  });

  $("#integrationModal").on("hidden.bs.modal", resetIntegrationForm);

  sessionReady.then(() => {
    checkApiHealth();
    loadIntegrations();
  }).catch(() => {});
});
