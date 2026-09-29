const loginForm = document.getElementById("login-form");
const loginHeading = document.getElementById("login-heading");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");
const loginDescription = document.getElementById("login-description");
const loginKicker = document.getElementById("login-kicker");
const loginHelp = document.getElementById("login-help");
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("password-toggle");
let setupMode = false;

function loginNotice(message, error = false) {
  loginMessage.textContent = message;
  loginMessage.className = message ? `login-message ${error ? "is-error" : "is-info"}` : "login-message";
  loginMessage.setAttribute("role", error ? "alert" : "status");
}

async function prepareLogin() {
  try {
    const { data } = await statusConfiguracao();
    setupMode = data.required;
    document.body.classList.toggle("is-setup", setupMode);
    if (setupMode) {
      loginKicker.textContent = "PRIMEIRO ACESSO";
      loginHeading.textContent = "Configure seu acesso";
      loginDescription.textContent = "Crie a conta do primeiro administrador para começar.";
      loginButton.textContent = "Criar administrador";
      loginHelp.textContent = "Disponível apenas neste computador. Sua senha deve ter pelo menos 12 caracteres.";
      passwordInput.autocomplete = "new-password";
    } else {
      loginKicker.textContent = "ACESSO À PLATAFORMA";
      loginHeading.textContent = "Bem-vindo de volta";
      loginDescription.textContent = "Entre com sua conta para continuar.";
      loginButton.textContent = "Entrar";
      loginHelp.textContent = "Precisa de acesso? Peça uma conta ao administrador.";
      passwordInput.autocomplete = "current-password";
    }
  } catch (error) {
    loginNotice(`Não foi possível conectar à API: ${error.message}`, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  loginNotice("");
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (setupMode) await configurarAdmin(email, password);
    else await entrar(email, password);
    const target = sessionStorage.getItem("returnTo");
    sessionStorage.removeItem("returnTo");
    location.replace(target && target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard/index.html");
  } catch (error) {
    loginNotice(error.message, true);
    if (setupMode) await prepareLogin();
  } finally {
    loginButton.disabled = false;
  }
});

passwordToggle.addEventListener("click", () => {
  const visible = passwordInput.type === "password";
  passwordInput.type = visible ? "text" : "password";
  passwordToggle.textContent = visible ? "Ocultar" : "Mostrar";
  passwordToggle.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
  passwordToggle.setAttribute("aria-pressed", String(visible));
});

prepareLogin();
