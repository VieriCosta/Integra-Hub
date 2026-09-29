const integrationService = require("../services/integrationService");

async function listIntegrations(req, res, next) {
  try {
    const integrations = await integrationService.listIntegrations(req.user, req.query.ownerId);

    res.json({
      success: true,
      data: integrations
    });
  } catch (error) {
    next(error);
  }
}

async function getIntegrationById(req, res, next) {
  try {
    const integration = await integrationService.getIntegrationById(req.params.id, req.user);

    res.json({
      success: true,
      data: integration
    });
  } catch (error) {
    next(error);
  }
}

async function createIntegration(req, res, next) {
  try {
    const integration = await integrationService.createIntegration(req.body, req.user);

    res.status(201).json({
      success: true,
      data: integration
    });
  } catch (error) {
    next(error);
  }
}

async function updateIntegration(req, res, next) {
  try {
    const integration = await integrationService.updateIntegration(req.params.id, req.body, req.user);

    res.json({
      success: true,
      data: integration
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listIntegrations,
  getIntegrationById,
  createIntegration,
  updateIntegration
};
