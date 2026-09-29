const usersBody = document.getElementById("users-table-body");
const passwordModal = new bootstrap.Modal(document.getElementById("password-modal"));
let usersPage = 1;
let passwordUser = null;
let listedUsers = [];

function adminAlert(message, error = false) {
  const target = document.getElementById("admin-alert");
  target.textContent = message;
  target.className = message ? `alert alert-${error ? "danger" : "success"}` : "";
}

function adminCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value === null || value === undefined ? "–" : String(value);
  row.append(cell);
  return cell;
}

function adminLink(parent, label, path, id) {
  const link = document.createElement("a");
  link.className = "btn btn-sm btn-outline-primary";
  link.href = `${path}?ownerId=${encodeURIComponent(id)}`;
  link.textContent = label;
  parent.append(link);
}

function adminButton(parent, label, action, id, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-sm btn-outline-secondary";
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  button.disabled = disabled;
  parent.append(button);
}

function renderUsers(data) {
  listedUsers = data.items;
  usersBody.replaceChildren();
  if (!data.items.length) {
    const row = document.createElement("tr");
    adminCell(row, "Nenhum usuário encontrado.").colSpan = 9;
    usersBody.append(row);
  }
  for (const user of data.items) {
    const row = document.createElement("tr");
    adminCell(row, user.email);
    adminCell(row, user.role === "ADMIN" ? "Administrador" : "Usuário");
    adminCell(row, user.isActive ? "Ativo" : "Desativado");
    adminCell(row, user.loggedIn ? "Aberta" : "Encerrada");
    adminCell(row, user.online ? "Online" : "Offline");
    adminCell(row, user.lastSeenAt ? new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short", timeStyle: "short"
    }).format(new Date(user.lastSeenAt)) : null);
    adminCell(row, user.integrationCount);
    adminCell(row, user.executionCount);
    const actions = document.createElement("td");
    actions.className = "admin-actions";
    adminLink(actions, "Dashboard", "/dashboard/index.html", user.id);
    adminLink(actions, "Integrações", "/integracoes/index.html", user.id);
    adminLink(actions, "Execuções", "/execucoes/index.html", user.id);
    adminLink(actions, "Logs", "/logs/index.html", user.id);
    adminLink(actions, "Auditoria", "/auditoria/index.html", user.id);
    const self = user.id === window.currentUser.id;
    adminButton(actions, user.isActive ? "Desativar" : "Ativar", "toggle", user.id, self);
    adminButton(actions, user.role === "ADMIN" ? "Tornar usuário" : "Tornar admin", "role", user.id, self);
    adminButton(actions, "Redefinir senha", "password", user.id);
    row.append(actions);
    usersBody.append(row);
  }
  document.getElementById("total-users").textContent = data.summary.totalUsers;
  document.getElementById("logged-in-users").textContent = data.summary.loggedInUsers;
  document.getElementById("online-users").textContent = data.summary.onlineUsers;
  document.getElementById("open-sessions").textContent = data.summary.openSessions;
  document.getElementById("total-executions").textContent = data.summary.totalExecutions;
  document.getElementById("users-count").textContent = `${data.total} usuário(s)`;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  document.getElementById("page-label").textContent = `Página ${data.page} de ${pages}`;
  document.getElementById("previous-page").disabled = usersPage <= 1;
  document.getElementById("next-page").disabled = usersPage >= pages;
}

async function loadUsers() {
  try {
    const { data } = await listarUsuarios(usersPage);
    renderUsers(data);
    const status = document.getElementById("api-status");
    status.classList.replace("offline", "online");
    status.querySelector("span:last-child").textContent = "API Online";
  } catch (error) {
    adminAlert(error.message, true);
  }
}

document.getElementById("create-user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await criarUsuario({
      email: document.getElementById("new-user-email").value,
      password: document.getElementById("new-user-password").value,
      role: document.getElementById("new-user-role").value
    });
    event.currentTarget.reset();
    adminAlert("Conta criada com sucesso.");
    usersPage = 1;
    await loadUsers();
  } catch (error) { adminAlert(error.message, true); }
  finally { button.disabled = false; }
});

usersBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const user = listedUsers.find((item) => item.id === Number(button.dataset.id));
  if (!user) return;
  if (button.dataset.action === "password") {
    passwordUser = user;
    document.getElementById("password-user-email").textContent = user.email;
    document.getElementById("password-form").reset();
    passwordModal.show();
    return;
  }
  const change = button.dataset.action === "toggle"
    ? { isActive: !user.isActive }
    : { role: user.role === "ADMIN" ? "USER" : "ADMIN" };
  if (!confirm(`Confirmar alteração da conta ${user.email}?`)) return;
  button.disabled = true;
  try {
    await atualizarUsuario(user.id, change);
    adminAlert("Conta atualizada.");
    await loadUsers();
  } catch (error) { adminAlert(error.message, true); button.disabled = false; }
});

document.getElementById("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await redefinirSenha(passwordUser.id, document.getElementById("reset-password").value);
    passwordModal.hide();
    adminAlert("Senha atualizada. As sessões anteriores foram encerradas.");
    await loadUsers();
  } catch (error) { adminAlert(error.message, true); }
  finally { button.disabled = false; }
});

document.getElementById("refresh-button").addEventListener("click", loadUsers);
document.getElementById("previous-page").addEventListener("click", () => { if (usersPage > 1) { usersPage--; loadUsers(); } });
document.getElementById("next-page").addEventListener("click", () => { usersPage++; loadUsers(); });

sessionReady.then(loadUsers).catch(() => {});
