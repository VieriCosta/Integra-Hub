let environmentItems = [];
let environmentId = null;
function environmentMessage(message, error = false) {
  const element = document.getElementById('environment-alert'); element.textContent = message; element.className = error ? 'alert alert-danger' : message ? 'alert alert-success' : '';
}
function editEnvironment(item = null) {
  environmentId = item?.id || null;
  document.getElementById('environment-name').value = item?.name || '';
  document.getElementById('environment-stage').value = item?.stage || 'DEVELOPMENT';
  document.getElementById('environment-variables').value = JSON.stringify(item?.variables || {}, null, 2);
  document.getElementById('environment-form-title').textContent = item ? `Editar ${item.name}` : 'Novo ambiente';
}
async function loadEnvironments() {
  try {
    const { data } = await requestJson('/environments'); environmentItems = data;
    const list = document.getElementById('environment-list'); list.replaceChildren();
    if (!data.length) list.textContent = 'Nenhum ambiente cadastrado.';
    for (const item of data) {
      const row = document.createElement('div'); row.className = 'd-flex gap-3 flex-wrap py-3';
      const label = document.createElement('span'); label.textContent = `${item.name} · ${{ DEVELOPMENT: 'Desenvolvimento', STAGING: 'Homologação', PRODUCTION: 'Produção' }[item.stage]} · ${Object.keys(item.variables).length} variável(is)`;
      const button = document.createElement('button'); button.className = 'btn btn-outline-primary btn-sm'; button.textContent = 'Editar'; button.addEventListener('click', () => editEnvironment(item));
      row.append(label, button); list.append(row);
    }
  } catch (error) { environmentMessage(error.message, true); }
}
document.getElementById('new-environment').addEventListener('click', () => editEnvironment());
document.getElementById('environment-form').addEventListener('submit', async event => {
  event.preventDefault(); event.submitter.disabled = true;
  try {
    let variables;
    try { variables = JSON.parse(document.getElementById('environment-variables').value); } catch { throw new Error('Confira o JSON das variáveis.'); }
    const { data } = await requestJson(environmentId ? `/environments/${environmentId}` : '/environments', { method: environmentId ? 'PUT' : 'POST', body: JSON.stringify({ name: document.getElementById('environment-name').value, stage: document.getElementById('environment-stage').value, variables }) });
    editEnvironment(data); await loadEnvironments(); environmentMessage('Ambiente salvo. Os valores estão protegidos.');
  } catch (error) { environmentMessage(error.message, true); }
  finally { event.submitter.disabled = false; }
});
sessionReady.then(loadEnvironments).catch(() => {});
