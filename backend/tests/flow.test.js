const { test } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { validateDestinationUrl, isPublicAddress } = require("../src/utils/urlValidator");
const { getIntegrationTimeoutMs } = require("../src/config/integrationConfig");

test("destinos internos e timeout excessivo são bloqueados", () => {
  for (const url of [
    "http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/",
    "http://[::1]/", "http://[::ffff:127.0.0.1]/", "file:///etc/passwd"
  ]) assert.equal(validateDestinationUrl(url), false, url);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(validateDestinationUrl("https://1.1.1.1/test"), true);
  const old = process.env.INTEGRATION_TIMEOUT_MS;
  process.env.INTEGRATION_TIMEOUT_MS = "999999";
  assert.equal(getIntegrationTimeoutMs(), 30000);
  if (old === undefined) delete process.env.INTEGRATION_TIMEOUT_MS;
  else process.env.INTEGRATION_TIMEOUT_MS = old;
});

test("redirecionamento para outra origem não encaminha o body", async () => {
  const { executeHttpRequest } = require("../src/services/httpClientService");
  const oldAdapter = axios.defaults.adapter;
  let calls = 0;
  axios.defaults.adapter = async (config) => {
    calls++;
    return {
      status: 307, data: "", headers: { location: "https://8.8.8.8/receive" }, config
    };
  };
  try {
    const result = await executeHttpRequest({
      baseUrl: "https://1.1.1.1/send", method: "POST",
      headers: { Authorization: "Bearer secret" }, body: { token: "secret" }
    });
    assert.equal(result.status, "ERROR");
    assert.match(result.errorMessage, /entre origens/);
    assert.equal(calls, 1);
  } finally {
    axios.defaults.adapter = oldAdapter;
  }
});

test("login, isolamento por usuário, admin, HTTP 200/404 e auditoria no PostgreSQL", {
  skip: !process.env.TEST_DATABASE_URL && "Defina TEST_DATABASE_URL para um banco de testes"
}, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const prisma = require("../src/config/prisma");
  const app = require("../src/app");
  const { recoverStaleExecutions } = require("../src/services/integrationExecutionService");
  const oldAdapter = axios.defaults.adapter;
  const createdIds = [];
  let adminCookie;
  let adminId;
  let userId;
  axios.defaults.adapter = async (config) => {
    assert.equal(config.maxContentLength, 1024 * 1024);
    assert.ok(config.timeout <= 30000);
    if (config.url.includes("/redirect")) {
      return { status: 302, data: "", headers: { location: "http://127.0.0.1/private" }, config };
    }
    const status = config.url.includes("/missing") ? 404 : 200;
    return { status, data: { status, token: "response-secret", ok: true }, headers: {}, config };
  };
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, method = "GET", body, cookie = adminCookie, origin) => {
    const response = await fetch(base + path, {
      method, headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {
      status: response.status, body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0]
    };
  };
  try {
    assert.equal((await request("/integrations", "GET", undefined, null)).status, 401);
    assert.equal((await request("/auth/setup-status", "GET", undefined, null)).body.data.required, true);
    const setup = await request("/auth/setup", "POST", {
      email: "admin@example.test", password: "admin-password-1234"
    }, null);
    assert.equal(setup.status, 201);
    assert.ok(setup.cookie?.startsWith("ih_session="));
    adminCookie = setup.cookie;
    adminId = setup.body.data.id;
    assert.equal((await request("/auth/setup", "POST", {
      email: "other@example.test", password: "other-password-1234"
    }, null)).status, 409);
    assert.equal((await request("/auth/me")).body.data.role, "ADMIN");
    assert.equal((await request("/integrations", "POST", {
      name: "Blocked", baseUrl: "https://1.1.1.1/ok", method: "GET"
    }, adminCookie, "https://evil.example")).status, 403);

    for (const [path, expected] of [["ok", "SUCCESS"], ["missing", "ERROR"], ["redirect", "ERROR"]]) {
      const created = await request("/integrations", "POST", {
        name: `Teste ${path}`, baseUrl: `https://1.1.1.1/${path}?key=url-secret`, method: "GET",
        headers: { Authorization: "Bearer secret", Accept: "application/json" },
        queryParams: { apiKey: "query-secret" }
      });
      assert.equal(created.status, 201);
      const id = created.body.data.id;
      createdIds.push(id);
      assert.equal(created.body.data.headers.Authorization, "********");
      assert.equal(created.body.data.queryParams.apiKey, "********");
      assert.ok(!JSON.stringify(created.body.data).includes("url-secret"));

      const fetched = await request(`/integrations/${id}`);
      assert.equal(fetched.body.data.headers.Authorization, "********");
      const updated = await request(`/integrations/${id}`, "PUT", fetched.body.data);
      assert.equal(updated.status, 200);
      const storedIntegration = await prisma.integration.findUnique({ where: { id } });
      assert.equal(storedIntegration.headers.Authorization, "Bearer secret");
      assert.equal(storedIntegration.queryParams.apiKey, "query-secret");
      assert.ok(storedIntegration.baseUrl.includes("url-secret"));

      const execution = await request(`/integrations/${id}/execute`, "POST");
      assert.equal(execution.status, 202);
      for (let count = 0; count < 100 && ['PENDING', 'RUNNING'].includes(execution.body.data.status); count++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        execution.body = (await request(`/executions/${execution.body.data.id}`)).body;
      }
      assert.equal(execution.body.data.status, expected);
      if (path !== "redirect") assert.equal(execution.body.data.httpStatus, path === "ok" ? 200 : 404);
      else assert.match(execution.body.data.errorMessage, /não permitido/);

      const history = await request(`/integrations/${id}/executions?page=1&pageSize=1`);
      assert.equal(history.body.data.total, 1);
      assert.equal(history.body.data.items[0].status, expected);
      const globalHistory = await request(`/executions?integrationId=${id}&pageSize=1`);
      assert.equal(globalHistory.body.data.total, 1);
      assert.equal(globalHistory.body.data.items[0].integration.name, `Teste ${path}`);
      const logs = await request(`/executions?status=ERROR&integrationId=${id}`);
      assert.equal(logs.body.data.total, expected === "ERROR" ? 1 : 0);
      const audit = await request(`/audit?integrationId=${id}`);
      assert.equal(audit.body.data.total, 4);
      assert.ok(audit.body.data.items.some((item) => item.action === "INTEGRATION_CREATED"));
      assert.ok(audit.body.data.items.some((item) => item.action === "INTEGRATION_UPDATED"));
      assert.ok(audit.body.data.items.some((item) => item.action === "EXECUTION_FINISHED" && item.status === expected));
      assert.ok(audit.body.data.items.every((item) => item.actor?.id === adminId));
      const details = await request(`/executions/${execution.body.data.id}`);
      assert.equal(details.body.data.requestHeaders.Authorization, "********");
      assert.equal(details.body.data.requestQueryParams.apiKey, "********");
      assert.ok(!details.body.data.requestUrl.includes("url-secret"));
      if (path !== "redirect") assert.equal(details.body.data.responseBody.token, "********");
      const persisted = await prisma.integrationExecution.findUnique({ where: { id: execution.body.data.id } });
      assert.equal(persisted.requestHeaders.Authorization, "********");
      assert.equal(persisted.requestQueryParams.apiKey, "********");
      assert.ok(!persisted.requestUrl.includes("url-secret"));
    }

    const newUser = await request("/admin/users", "POST", {
      email: "user@example.test", password: "user-password-1234", role: "USER"
    });
    assert.equal(newUser.status, 201);
    userId = newUser.body.data.id;
    assert.equal(newUser.body.data.passwordHash, undefined);
    const userLogin = await request("/auth/login", "POST", {
      email: "user@example.test", password: "user-password-1234"
    }, null);
    assert.equal(userLogin.status, 200);
    const userCookie = userLogin.cookie;
    assert.ok(userCookie);

    const legacy = await prisma.integration.create({
      data: { name: "Legacy", baseUrl: "https://1.1.1.1/ok", method: "GET" }
    });
    createdIds.push(legacy.id);

    const userIntegration = await request("/integrations", "POST", {
      name: "Only user", baseUrl: "https://1.1.1.1/missing", method: "GET", ownerId: adminId
    }, userCookie);
    assert.equal(userIntegration.status, 201);
    const ownId = userIntegration.body.data.id;
    createdIds.push(ownId);
    assert.equal(userIntegration.body.data.ownerId, userId);
    const userExecution = await request(`/integrations/${ownId}/execute`, "POST", undefined, userCookie);
    for (let count = 0; count < 100 && ['PENDING', 'RUNNING'].includes(userExecution.body.data.status); count++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      userExecution.body = (await request(`/executions/${userExecution.body.data.id}`, 'GET', undefined, userCookie)).body;
    }
    assert.equal(userExecution.body.data.status, "ERROR");

    assert.deepEqual((await request("/integrations", "GET", undefined, userCookie)).body.data.map((item) => item.id), [ownId]);
    assert.equal((await request(`/integrations/${legacy.id}`, "GET", undefined, userCookie)).status, 404);
    assert.equal((await request(`/integrations/${legacy.id}`)).status, 200);
    assert.equal((await request("/dashboard", "GET", undefined, userCookie)).body.data.totalIntegrations, 1);
    assert.equal((await request("/executions", "GET", undefined, userCookie)).body.data.total, 1);
    assert.equal((await request("/executions?status=ERROR", "GET", undefined, userCookie)).body.data.total, 1);
    assert.equal((await request("/audit", "GET", undefined, userCookie)).body.data.total, 3);
    assert.equal((await request(`/integrations/${createdIds[0]}`, "GET", undefined, userCookie)).status, 404);
    assert.equal((await request(`/integrations/${createdIds[0]}/execute`, "POST", undefined, userCookie)).status, 404);
    assert.equal((await request(`/integrations/${createdIds[0]}/executions`, "GET", undefined, userCookie)).status, 404);
    assert.equal((await request(`/executions/${(await request(`/integrations/${createdIds[0]}/executions`)).body.data.items[0].id}`, "GET", undefined, userCookie)).status, 404);
    assert.equal((await request(`/audit?integrationId=${createdIds[0]}`, "GET", undefined, userCookie)).body.data.total, 0);
    assert.equal((await request(`/executions?ownerId=${adminId}`, "GET", undefined, userCookie)).status, 403);
    assert.equal((await request(`/integrations?ownerId=${adminId}`, "GET", undefined, userCookie)).status, 403);
    assert.equal((await request("/admin/users", "GET", undefined, userCookie)).status, 403);

    assert.equal((await request(`/integrations?ownerId=${userId}`)).body.data.length, 1);
    assert.equal((await request(`/executions?ownerId=${userId}`)).body.data.total, 1);
    assert.equal((await request(`/audit?ownerId=${userId}`)).body.data.total, 3);
    const users = await request("/admin/users");
    assert.equal(users.body.data.summary.totalUsers, 2);
    assert.equal(users.body.data.summary.loggedInUsers, 2);
    assert.equal(users.body.data.summary.onlineUsers, 2);
    assert.ok(users.body.data.summary.openSessions >= 2);
    const onBehalf = await request("/integrations", "POST", {
      name: "Created by admin for user", baseUrl: "https://1.1.1.1/ok",
      method: "GET", ownerId: userId
    });
    assert.equal(onBehalf.status, 201);
    createdIds.push(onBehalf.body.data.id);
    assert.equal(onBehalf.body.data.ownerId, userId);
    assert.equal((await request(`/integrations/${onBehalf.body.data.id}`, "GET", undefined, userCookie)).status, 200);
    const behalfAudit = await request(`/audit?integrationId=${onBehalf.body.data.id}`);
    assert.equal(behalfAudit.body.data.items[0].actor.id, adminId);
    assert.equal((await request("/auth/logout", "POST", undefined, userCookie)).status, 200);
    assert.equal((await request("/auth/me", "GET", undefined, userCookie)).status, 401);
    assert.equal((await request(`/admin/users/${adminId}`, "PATCH", { isActive: false })).status, 400);
    assert.equal((await request(`/admin/users/${userId}/reset-password`, "POST", {
      password: "new-password-1234"
    })).status, 200);
    assert.equal((await request("/auth/login", "POST", {
      email: "user@example.test", password: "user-password-1234"
    }, null)).status, 401);
    const newLogin = await request("/auth/login", "POST", {
      email: "user@example.test", password: "new-password-1234"
    }, null);
    assert.equal(newLogin.status, 200);
    assert.equal((await request("/auth/change-password", "POST", {
      currentPassword: "wrong-password", newPassword: "user-changed-5678"
    }, newLogin.cookie)).status, 400);
    assert.equal((await request("/auth/change-password", "POST", {
      currentPassword: "new-password-1234", newPassword: "user-changed-5678"
    }, newLogin.cookie)).status, 200);
    assert.equal((await request("/auth/me", "GET", undefined, newLogin.cookie)).status, 401);
    const changedLogin = await request("/auth/login", "POST", {
      email: "user@example.test", password: "user-changed-5678"
    }, null);
    assert.equal(changedLogin.status, 200);
    assert.equal((await request(`/admin/users/${userId}`, "PATCH", { isActive: false })).status, 200);
    assert.equal((await request("/auth/me", "GET", undefined, changedLogin.cookie)).status, 401);
    assert.equal((await request("/auth/login", "POST", {
      email: "user@example.test", password: "user-changed-5678"
    }, null)).status, 401);

    const old = await prisma.integrationExecution.create({
      data: { integrationId: createdIds[0], status: "RUNNING", startedAt: new Date(Date.now() - 180000) }
    });
    await recoverStaleExecutions();
    const recovered = await prisma.integrationExecution.findUnique({ where: { id: old.id } });
    assert.equal(recovered.status, "ERROR");
    const recoveredAudit = await request(`/audit?action=EXECUTION_RECOVERED&integrationId=${createdIds[0]}`);
    assert.equal(recoveredAudit.body.data.total, 1);
    assert.equal(recoveredAudit.body.data.items[0].executionId, old.id);
    const secondPage = await request(`/integrations/${createdIds[0]}/executions?page=2&pageSize=1`);
    assert.equal(secondPage.body.data.total, 2);
    assert.equal(secondPage.body.data.items.length, 1);
    for (const path of ["/executions?page=0", "/executions?status=UNKNOWN", "/audit?pageSize=101", "/audit?action=UNKNOWN"]) {
      assert.equal((await request(path)).status, 400, path);
    }
  } finally {
    await require('../src/services/queueService').stopWorker();
    axios.defaults.adapter = oldAdapter;
    for (const id of createdIds) {
      await prisma.auditEvent.deleteMany({ where: { integrationId: id } });
      await prisma.executionJob.deleteMany({ where: { integrationId: id } });
      await prisma.integrationAlert.deleteMany({ where: { integrationId: id } });
      await prisma.integrationExecution.deleteMany({ where: { integrationId: id } });
      await prisma.integration.delete({ where: { id } });
    }
    await prisma.authSession.deleteMany({ where: { userId: { in: [adminId, userId].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, userId].filter(Boolean) } } });
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
