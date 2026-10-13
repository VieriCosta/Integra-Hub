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

async function getDashboardMetrics(user, ownerIdValue, daysValue = 7) {
  const days = Number(daysValue);
  if (![7, 14, 30].includes(days)) throw new (require('../utils/AppError').AppError)('Período inválido.', 400);
  const { startOfDay, endOfDay } = getTodayRange();
  const integrationScope = ownerWhere(user, ownerIdValue);
  const executionScope = executionOwnerWhere(user, ownerIdValue);

  const [totalIntegrations, executionsToday, successToday, errorsToday] = await Promise.all([
    dashboardRepository.countIntegrations(integrationScope),
    executionRepository.countToday(startOfDay, endOfDay, executionScope),
    executionRepository.countTodayByStatus(startOfDay, endOfDay, "SUCCESS", executionScope),
    executionRepository.countTodayByStatus(startOfDay, endOfDay, "ERROR", executionScope)
  ]);

  const prisma = require('../config/prisma');
  // Calendar days in Fortaleza, independent of the server timezone.
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' }) + 'T00:00:00-03:00');
  const since = new Date(today.getTime() - (days - 1) * 86400000);
  const periodWhere = { ...executionScope, createdAt: { gte: since } };
  const [aggregate, counts, latestErrors, daily] = await Promise.all([
    prisma.integrationExecution.aggregate({ where: { ...periodWhere, status: { in: ['SUCCESS', 'ERROR'] } }, _avg: { durationMs: true } }),
    prisma.integrationExecution.groupBy({ by: ['status'], where: periodWhere, _count: { _all: true } }),
    prisma.integrationExecution.findMany({ where: { ...periodWhere, status: 'ERROR' }, take: 5, orderBy: { id: 'desc' }, select: { id: true, httpStatus: true, createdAt: true, durationMs: true, integration: { select: { id: true, name: true } } } }),
    Promise.all(Array.from({ length: days }, async (_, index) => {
      const date = new Date(since.getTime() + index * 86400000);
      const groups = await prisma.integrationExecution.groupBy({ by: ['status'], where: { ...executionScope, createdAt: { gte: date, lt: new Date(date.getTime() + 86400000) } }, _count: { _all: true } });
      return { date: date.toISOString().slice(0, 10), success: groups.find(g => g.status === 'SUCCESS')?._count._all || 0, error: groups.find(g => g.status === 'ERROR')?._count._all || 0 };
    }))
  ]);
  const successes = counts.find(g => g.status === 'SUCCESS')?._count._all || 0;
  const errors = counts.find(g => g.status === 'ERROR')?._count._all || 0;
  return {
    days, daily, latestErrors,
    successRate: successes + errors ? Math.round(successes / (successes + errors) * 1000) / 10 : null,
    averageDurationMs: Math.round(aggregate._avg.durationMs || 0),
    totalIntegrations,
    executionsToday,
    successToday,
    errorsToday
  };
}

module.exports = {
  getDashboardMetrics
};
