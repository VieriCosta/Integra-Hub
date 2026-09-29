const PUBLIC_HEADERS = new Set(["accept", "content-type", "user-agent", "accept-language", "cache-control"]);
const REDACTED = "********";
const SECRET_KEY = /auth|token|secret|password|passwd|credential|session|cookie|api[-_]?key|client[-_]?key/i;

function maskSensitiveHeaders(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return headers || null;
  }

  return Object.entries(headers).reduce((maskedHeaders, [key, value]) => {
    const normalizedKey = String(key).toLowerCase();
    maskedHeaders[key] = PUBLIC_HEADERS.has(normalizedKey) ? value : REDACTED;
    return maskedHeaders;
  }, {});
}

function redactJson(value, redactAll = false) {
  if (Array.isArray(value)) return value.map((item) => redactJson(item, redactAll));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key, redactAll || SECRET_KEY.test(key) ? REDACTED : redactJson(item)
    ]));
  }
  return redactAll ? REDACTED : value;
}

function redactUrl(value) {
  if (!value) return value;
  try {
    const url = new URL(value);
    for (const key of url.searchParams.keys()) url.searchParams.set(key, REDACTED);
    return url.toString();
  } catch {
    return value;
  }
}

function preserveRedacted(incoming, previous) {
  if (incoming === REDACTED) return previous;
  if (Array.isArray(incoming)) return incoming.map((item, index) => preserveRedacted(item, previous?.[index]));
  if (incoming && typeof incoming === "object") {
    return Object.fromEntries(Object.entries(incoming).map(([key, item]) => [
      key, preserveRedacted(item, previous?.[key])
    ]));
  }
  return incoming;
}

function sanitizeIntegration(integration) {
  if (!integration) return integration;
  return {
    ...integration,
    baseUrl: redactUrl(integration.baseUrl),
    headers: maskSensitiveHeaders(integration.headers),
    queryParams: redactJson(integration.queryParams, true),
    body: redactJson(integration.body)
  };
}

function sanitizeExecution(execution) {
  if (!execution) return execution;
  return {
    ...execution,
    requestUrl: redactUrl(execution.requestUrl),
    requestHeaders: maskSensitiveHeaders(execution.requestHeaders),
    requestQueryParams: redactJson(execution.requestQueryParams, true),
    requestBody: redactJson(execution.requestBody),
    responseBody: redactJson(execution.responseBody)
  };
}

module.exports = {
  REDACTED, maskSensitiveHeaders, redactJson, redactUrl,
  preserveRedacted, sanitizeIntegration, sanitizeExecution
};
