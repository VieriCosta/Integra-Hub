const sessionReady = (async () => {
  document.body.classList.add("auth-loading");
  try {
    const { data: user } = await minhaConta();
    if (document.body.dataset.adminOnly === "true" && user.role !== "ADMIN") {
      location.replace("/dashboard/index.html");
      const error = new Error("Acesso restrito ao administrador.");
      error.forbidden = true;
      throw error;
    }
    window.currentUser = user;
    const nav = document.querySelector(".sidebar-nav");
    if (user.role === "ADMIN" && nav) {
      const link = document.createElement("a");
      link.className = `nav-link${document.body.dataset.adminOnly === "true" ? " active" : ""}`;
      link.href = "/admin/index.html";
      link.textContent = "Administração";
      if (document.body.dataset.adminOnly === "true") link.setAttribute("aria-current", "page");
      nav.append(link);
    }
    const selectedOwnerId = new URLSearchParams(location.search).get("ownerId");
    if (user.role === "ADMIN" && selectedOwnerId && nav) {
      for (const link of nav.querySelectorAll('a[href$="/index.html"]')) {
        if (link.pathname === "/admin/index.html") continue;
        link.href = `${link.pathname}?ownerId=${encodeURIComponent(selectedOwnerId)}`;
      }
    }
    const topbar = document.querySelector(".topbar");
    if (topbar) {
      const group = document.createElement("div");
      group.className = "topbar-actions";
      const status = document.getElementById("api-status");
      if (status) group.append(status);
      const identity = document.createElement("span");
      identity.className = "account-identity";
      identity.textContent = `${user.email} · ${user.role === "ADMIN" ? "Administrador" : "Usuário"}`;
      const logoutButton = document.createElement("button");
      const profileLink = document.createElement("a");
      profileLink.href = "/perfil/index.html";
      profileLink.className = "btn btn-sm btn-outline-primary";
      profileLink.textContent = "Minha conta";
      logoutButton.type = "button";
      logoutButton.className = "btn btn-sm btn-outline-secondary";
      logoutButton.textContent = "Sair";
      logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try { await sair(); } catch { /* Sessão já pode ter expirado. */ }
        sessionStorage.removeItem("returnTo");
        location.replace("/login/index.html");
      });
      group.append(identity, profileLink, logoutButton);
      topbar.append(group);
    }
    document.body.classList.remove("auth-loading");
    return user;
  } catch (error) {
    if (!error.forbidden && location.pathname !== "/login/index.html") {
      sessionStorage.setItem("returnTo", location.pathname + location.search);
      location.replace("/login/index.html");
    }
    throw error;
  }
})();
