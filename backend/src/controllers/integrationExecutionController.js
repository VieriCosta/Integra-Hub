const integrationExecutionService = require("../services/integrationExecutionService");

async function executeIntegration(req, res, next) {
  try {
    const execution = await integrationExecutionService.executeIntegration(req.params.id, req.user);

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    next(error);
  }
}

async function listExecutionsByIntegration(req, res, next) {
  try {
    const executions = await integrationExecutionService.listExecutionsByIntegration(
      req.params.id, req.query.page, req.query.pageSize, req.user
    );

    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    next(error);
  }
}

async function getExecutionById(req, res, next) {
  try {
    const execution = await integrationExecutionService.getExecutionById(req.params.id, req.user);

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    next(error);
  }
}

async function listExecutions(req, res, next) {
  try {
    const executions = await integrationExecutionService.listExecutions(
      req.query.page, req.query.pageSize, req.query.status, req.query.integrationId,
      req.user, req.query.ownerId
    );
    res.json({ success: true, data: executions });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  executeIntegration,
  listExecutionsByIntegration,
  listExecutions,
  getExecutionById
};
