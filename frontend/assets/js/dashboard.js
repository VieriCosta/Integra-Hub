async function loadDashboardPage() {
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
    const { data } = await carregarDashboard(ownerId);
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
