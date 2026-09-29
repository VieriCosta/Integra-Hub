require("dotenv").config();

const app = require("./src/app");
const { recoverStaleExecutions } = require("./src/services/integrationExecutionService");
const { cleanupExpiredSessions } = require("./src/services/authService");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`IntegraHub API running on ${HOST}:${PORT}`);
});

async function recover() {
  try {
    await recoverStaleExecutions();
  } catch (error) {
    console.error("Não foi possível recuperar execuções interrompidas:", error.message);
  }
}

recover();
setInterval(recover, 60000).unref();

async function cleanupSessions() {
  try {
    await cleanupExpiredSessions();
  } catch (error) {
    console.error("Não foi possível limpar sessões expiradas:", error.message);
  }
}

cleanupSessions();
setInterval(cleanupSessions, 60 * 60 * 1000).unref();
