let dashboardRequest = 0;
async function loadDashboardPage() {
  const currentRequest = ++dashboardRequest;
  const ownerId = new URLSearchParams(location.search).get("ownerId") || "";
  if (ownerId) {
    for (const link of document.querySelectorAll(".metric-link")) {
      const url = new URL(link.href);
      url.searchParams.set("ownerId", ownerId);
      link.href = url.pathname + url.search;
    }
    const auditLink = document.querySelector('a[href="/auditoria/index.html"]');
    if (auditLink) auditLink.href = `/auditoria/index.html?ownerId=${encodeURIComponent(ownerId)}`;
  }
  const status = document.getElementById("api-status");
  try {
    await verificarApi();
    status.classList.remove("offline");
    status.classList.add("online");
    status.querySelector("span:last-child").textContent = "API Online";
  } catch {
    status.classList.remove("online");
    status.classList.add("offline");
    status.querySelector("span:last-child").textContent = "API Offline";
  }

  try {
    const { data } = await carregarDashboard(ownerId, Number(document.getElementById('dashboard-period').value));
    if (currentRequest !== dashboardRequest) return;
    document.getElementById('period-summary').textContent = `Sucesso: ${data.successRate === null ? 'Sem execuções finalizadas' : data.successRate + '%'} · Tempo médio: ${data.averageDurationMs} ms`;
    const chart = document.getElementById('daily-chart');
    chart.replaceChildren();
    const max = Math.max(1, ...data.daily.map(day => day.success + day.error));
    for (const day of data.daily) {
      const column = document.createElement('div');
      column.className = 'daily-column';
      column.title = `${day.date}: ${day.success} sucessos, ${day.error} erros`;
      column.setAttribute('role', 'img');
      column.setAttribute('aria-label', column.title);
      for (const status of ['error', 'success']) {
        const bar = document.createElement('div');
        bar.className = `daily-bar ${status}`;
        bar.style.height = `${day[status] / max * 120}px`;
        column.append(bar);
      }
      const label = document.createElement('small');
      label.textContent = `${day.date.slice(8)}/${day.date.slice(5, 7)}`;
      column.append(label);
      chart.append(column);
    }
    const failures = document.getElementById('latest-errors');
    failures.replaceChildren();
    if (!data.latestErrors.length) failures.textContent = 'Nenhuma falha no período.';
    for (const item of data.latestErrors) {
      const link = document.createElement('a');
      link.className = 'd-block py-2';
      link.href = `/execucoes/index.html?executionId=${item.id}${ownerId ? `&ownerId=${encodeURIComponent(ownerId)}` : ''}`;
      link.textContent = `${item.integration.name} · HTTP ${item.httpStatus ?? '—'} · ${new Date(item.createdAt).toLocaleString('pt-BR')}`;
      failures.append(link);
    }
    document.getElementById("metric-integrations").textContent = data.totalIntegrations;
    document.getElementById("metric-executions").textContent = data.executionsToday;
    document.getElementById("metric-success").textContent = data.successToday;
    document.getElementById("metric-errors").textContent = data.errorsToday;
  } catch (error) {
    document.getElementById("dashboard-alert").textContent = `Não foi possível carregar o dashboard: ${error.message}`;
    document.getElementById("dashboard-alert").className = "alert alert-danger";
  }
}

sessionReady.then(loadDashboardPage).catch(() => {});
document.getElementById('dashboard-period').addEventListener('change', loadDashboardPage);
