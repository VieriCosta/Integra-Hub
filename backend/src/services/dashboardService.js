const dashboardRepository = require("../repositories/dashboardRepository");
const executionRepository = require("../repositories/integrationExecutionRepository");
const { ownerWhere, executionOwnerWhere } = require("../utils/accessScope");

function getTodayRange() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return {
    startOfDay,
    endOfDay
  };
}

async function getDashboardMetrics(user, ownerIdValue) {
  const { startOfDay, endOfDay } = getTodayRange();
  const integrationScope = ownerWhere(user, ownerIdValue);
  const executionScope = executionOwnerWhere(user, ownerIdValue);

  const [totalIntegrations, executionsToday, successToday, errorsToday] = await Promise.all([
    dashboardRepository.countIntegrations(integrationScope),
    executionRepository.countToday(startOfDay, endOfDay, executionScope),
    executionRepository.countTodayByStatus(startOfDay, endOfDay, "SUCCESS", executionScope),
    executionRepository.countTodayByStatus(startOfDay, endOfDay, "ERROR", executionScope)
  ]);

  return {
    totalIntegrations,
    executionsToday,
    successToday,
    errorsToday
  };
}

module.exports = {
  getDashboardMetrics
};
