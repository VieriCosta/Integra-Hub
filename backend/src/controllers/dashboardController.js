const dashboardService = require("../services/dashboardService");

async function getDashboard(req, res, next) {
  try {
    const metrics = await dashboardService.getDashboardMetrics(req.user, req.query.ownerId, req.query.days);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard
};
