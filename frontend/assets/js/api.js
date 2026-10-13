const API_URL = `${location.protocol}//${location.hostname}:3000/api`;

async function requestJson(path, options = {}) {
  const { redirectOnUnauthorized = true, ...fetchOptions } = options;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {})
    },
    ...fetchOptions
  });

  const result = await response.json();

  if (response.status === 401 && redirectOnUnauthorized && !location.pathname.startsWith("/login/")) {
    sessionStorage.setItem("returnTo", location.pathname + location.search);
    location.replace("/login/index.html");
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Não foi possível concluir a requisição.");
  }

  return result;
}

async function verificarApi() {
  return requestJson("/health");
}

async function listarIntegracoes(ownerId = "") {
  const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
  return requestJson(`/integrations${query}`);
}

async function buscarIntegracao(id) {
  return requestJson(`/integrations/${id}`);
}

async function criarIntegracao(dados) {
  return requestJson("/integrations", {
    method: "POST",
    body: JSON.stringify(dados)
  });
}

async function atualizarIntegracao(id, dados) {
  return requestJson(`/integrations/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados)
  });
}

async function executarIntegracao(id) {
  const queued = await requestJson(`/integrations/${id}/execute`, {
    method: "POST"
  });
  for (let attempt = 0; attempt < 180; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const result = await buscarExecucao(queued.data.id);
    if (['SUCCESS', 'ERROR'].includes(result.data.status)) return result;
  }
  throw new Error(`Execução #${queued.data.id} continua na fila. Acompanhe em Execuções.`);
}

async function listarExecucoesIntegracao(id, page = 1) {
  return requestJson(`/integrations/${id}/executions?page=${page}&pageSize=20`);
}

async function buscarExecucao(id) {
  return requestJson(`/executions/${id}`);
}

async function carregarDashboard(ownerId = "", days = 7) {
  const query = `?days=${days}${ownerId ? `&ownerId=${encodeURIComponent(ownerId)}` : ''}`;
  return requestJson(`/dashboard${query}`);
}

async function listarExecucoes({ page = 1, pageSize = 20, status = "", integrationId = "", ownerId = "", from = '', to = '' } = {}) {
  const query = new URLSearchParams({ page, pageSize });
  if (status) query.set("status", status);
  if (integrationId) query.set("integrationId", integrationId);
  if (ownerId) query.set("ownerId", ownerId);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return requestJson(`/executions?${query}`);
}

async function listarAuditoria({ page = 1, pageSize = 20, action = "", integrationId = "", ownerId = "" } = {}) {
  const query = new URLSearchParams({ page, pageSize });
  if (action) query.set("action", action);
  if (integrationId) query.set("integrationId", integrationId);
  if (ownerId) query.set("ownerId", ownerId);
  return requestJson(`/audit?${query}`);
}

async function statusConfiguracao() {
  return requestJson("/auth/setup-status", { redirectOnUnauthorized: false });
}

async function configurarAdmin(email, password) {
  return requestJson("/auth/setup", {
    method: "POST", body: JSON.stringify({ email, password }), redirectOnUnauthorized: false
  });
}

async function entrar(email, password) {
  return requestJson("/auth/login", {
    method: "POST", body: JSON.stringify({ email, password }), redirectOnUnauthorized: false
  });
}

async function minhaConta() {
  return requestJson("/auth/me", { redirectOnUnauthorized: false });
}

async function sair() {
  return requestJson("/auth/logout", { method: "POST", redirectOnUnauthorized: false });
}

async function alterarMinhaSenha(currentPassword, newPassword) {
  return requestJson("/auth/change-password", {
    method: "POST", body: JSON.stringify({ currentPassword, newPassword })
  });
}

async function listarUsuarios(page = 1) {
  return requestJson(`/admin/users?page=${page}&pageSize=20`);
}

async function criarUsuario(data) {
  return requestJson("/admin/users", { method: "POST", body: JSON.stringify(data) });
}

async function atualizarUsuario(id, data) {
  return requestJson(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

async function redefinirSenha(id, password) {
  return requestJson(`/admin/users/${id}/reset-password`, {
    method: "POST", body: JSON.stringify({ password })
  });
}
