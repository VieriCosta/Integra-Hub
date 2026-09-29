const axios = require("axios");
const { performance } = require("perf_hooks");
const http = require("node:http");
const https = require("node:https");

const { getIntegrationTimeoutMs, MAX_RESPONSE_BYTES } = require("../config/integrationConfig");
const { assertSafeDestination, secureLookup } = require("../utils/urlValidator");
const { AppError } = require("../utils/AppError");

const httpAgent = new http.Agent({ lookup: secureLookup });
const httpsAgent = new https.Agent({ lookup: secureLookup });
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

function getResponseBody(response) {
  return response && response.data !== undefined ? response.data : null;
}

function getAxiosErrorMessage(error) {
  if (["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED"].includes(error.code)) {
    return "Timeout ao executar integração.";
  }

  if (error instanceof AppError) return error.message;
  if (error.message && error.message.includes("maxContentLength")) {
    return "Resposta HTTP excedeu o limite de 1 MB.";
  }

  if (error.response) {
    return `API externa retornou HTTP ${error.response.status}.`;
  }

  if (error.request) {
    return "Não foi possível conectar ao servidor.";
  }

  return "Erro interno ao executar integração.";
}

async function executeHttpRequest(integration) {
  const startedAt = new Date();
  const startedMark = performance.now();

  try {
    let url = integration.baseUrl;
    let method = integration.method;
    const headers = { ...(integration.headers || {}) };
    let params = integration.queryParams || {};
    let data = ["POST", "PUT", "PATCH"].includes(method) ? integration.body : undefined;
    const deadline = startedMark + getIntegrationTimeoutMs();
    let response;

    for (let redirects = 0; ; redirects++) {
      let remaining = Math.ceil(deadline - performance.now());
      if (remaining <= 0) throw Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" });
      await assertSafeDestination(url, remaining);
      remaining = Math.ceil(deadline - performance.now());
      if (remaining <= 0) throw Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" });
      response = await axios({
        url, method, headers, params, data,
        timeout: remaining,
        signal: AbortSignal.timeout(remaining),
        maxRedirects: 0,
        maxContentLength: MAX_RESPONSE_BYTES,
        maxBodyLength: MAX_RESPONSE_BYTES,
        proxy: false,
        httpAgent,
        httpsAgent,
        validateStatus: () => true
      });
      if (!REDIRECT_STATUSES.includes(response.status) || !response.headers.location) break;
      if (redirects >= 5) throw new AppError("Limite de redirecionamentos excedido.", 400);
      const nextUrl = new URL(response.headers.location, url).toString();
      if (new URL(nextUrl).origin !== new URL(url).origin) {
        throw new AppError("Redirecionamento entre origens não permitido.", 400);
      }
      await assertSafeDestination(nextUrl, Math.max(1, Math.ceil(deadline - performance.now())));
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
        method = "GET";
        data = undefined;
      }
      url = nextUrl;
      params = undefined;
    }

    const finishedAt = new Date();
    const durationMs = Math.round(performance.now() - startedMark);
    const success = response.status >= 200 && response.status <= 299;

    return {
      status: success ? "SUCCESS" : "ERROR",
      httpStatus: response.status,
      responseBody: getResponseBody(response),
      errorMessage: success ? null : `API externa retornou HTTP ${response.status}.`,
      startedAt,
      finishedAt,
      durationMs
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = Math.round(performance.now() - startedMark);

    return {
      status: "ERROR",
      httpStatus: error.response ? error.response.status : null,
      responseBody: error.response ? getResponseBody(error.response) : null,
      errorMessage: getAxiosErrorMessage(error),
      startedAt,
      finishedAt,
      durationMs
    };
  }
}

module.exports = {
  executeHttpRequest
};
