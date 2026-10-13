const automationOwner = new URLSearchParams(location.search).get('ownerId') || '';
const integrationSelect = document.getElementById('automation-integration');
let automationIntegrations = [];
function automationMessage(message, error = false) {
  const element = document.getElementById('automation-alert'); element.textContent = message; element.className = error ? 'alert alert-danger' : message ? 'alert alert-success' : '';
}
function fillAutomation() {
  const item = automationIntegrations.find(item => item.id === Number(integrationSelect.value));
  if (!item) return;
  document.getElementById('schedule-minutes').value = item.scheduleMinutes ?? '';
  document.getElementById('max-retries').value = item.maxRetries;
  document.getElementById('max-retries').disabled = item.method !== 'GET';
  document.getElementById('failure-threshold').value = item.failureThreshold;
  document.getElementById('slow-threshold').value = item.slowThresholdMs;
  document.getElementById('next-run').textContent = item.nextRunAt ? `Próxima execução: ${new Date(item.nextRunAt).toLocaleString('pt-BR')}` : 'Agendamento desligado.';
}
async function loadAutomation() {
  try {
    const selected = integrationSelect.value;
    const [integrations, overview] = await Promise.all([listarIntegracoes(automationOwner), requestJson(`/automation${automationOwner ? `?ownerId=${encodeURIComponent(automationOwner)}` : ''}`)]);
    automationIntegrations = integrations.data; integrationSelect.replaceChildren();
    for (const item of automationIntegrations) { const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.name} (${item.method})`; integrationSelect.append(option); }
    if (automationIntegrations.some(item => item.id === Number(selected))) integrationSelect.value = selected;
    document.querySelector('#automation-form button[type=submit]').disabled = !automationIntegrations.length;
    fillAutomation();
    const alerts = document.getElementById('automation-alerts'); alerts.replaceChildren();
    if (!overview.data.alerts.length) alerts.textContent = 'Nenhum alerta aberto.';
    for (const alert of overview.data.alerts) {
      const row = document.createElement('div'); row.className = 'd-flex flex-wrap gap-2 py-2';
      const label = document.createElement('span'); label.textContent = `${alert.integration.name}: ${alert.message} · ${new Date(alert.createdAt).toLocaleString('pt-BR')}`;
      const button = document.createElement('button'); button.className = 'btn btn-sm btn-outline-secondary'; button.textContent = 'Reconhecer';
      button.addEventListener('click', async () => { try { await requestJson(`/automation/alerts/${alert.id}/acknowledge`, { method: 'POST' }); await loadAutomation(); } catch (error) { automationMessage(error.message, true); } });
      row.append(label, button); alerts.append(row);
    }
    const jobs = document.getElementById('automation-jobs'); jobs.replaceChildren();
    if (!overview.data.jobs.length) jobs.textContent = 'Nenhuma execução aguardando ou em andamento.';
    for (const job of overview.data.jobs) { const row = document.createElement('p'); row.textContent = `#${job.executionId} · ${job.integration.name} · ${job.state === 'PENDING' ? 'Aguardando' : 'Executando'} · ${job.attempts} tentativa(s)`; jobs.append(row); }
  } catch (error) { automationMessage(error.message, true); }
}
integrationSelect.addEventListener('change', fillAutomation);
document.getElementById('refresh-automation').addEventListener('click', loadAutomation);
document.getElementById('automation-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    await requestJson(`/automation/integrations/${integrationSelect.value}`, { method: 'PUT', body: JSON.stringify({ scheduleMinutes: document.getElementById('schedule-minutes').value || null, maxRetries: document.getElementById('max-retries').disabled ? 0 : Number(document.getElementById('max-retries').value), failureThreshold: Number(document.getElementById('failure-threshold').value), slowThresholdMs: Number(document.getElementById('slow-threshold').value) }) });
    await loadAutomation(); automationMessage('Automação salva.');
  } catch (error) { automationMessage(error.message, true); }
  finally { button.disabled = false; }
});
sessionReady.then(loadAutomation).catch(() => {});
