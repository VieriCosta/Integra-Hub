const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function getIntegrationTimeoutMs() {
  const timeout = Number(process.env.INTEGRATION_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0
    ? Math.max(1, Math.min(Math.floor(timeout), MAX_TIMEOUT_MS)) : DEFAULT_TIMEOUT_MS;
}

module.exports = {
  getIntegrationTimeoutMs,
  MAX_RESPONSE_BYTES
};
