sessionReady.then((user) => {
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-role").textContent = user.role === "ADMIN" ? "Administrador" : "Usuário";
}).catch(() => {});

document.getElementById("password-change-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const alert = document.getElementById("profile-alert");
  const newPassword = document.getElementById("new-password").value;
  if (newPassword !== document.getElementById("confirm-password").value) {
    alert.textContent = "As novas senhas não são iguais.";
    alert.className = "alert alert-danger";
    return;
  }
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await alterarMinhaSenha(document.getElementById("current-password").value, newPassword);
    sessionStorage.removeItem("returnTo");
    location.replace("/login/index.html");
  } catch (error) {
    alert.textContent = error.message;
    alert.className = "alert alert-danger";
    button.disabled = false;
  }
});
