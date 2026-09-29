const auditService = require("../services/auditService");

async function listAuditEvents(req, res, next) {
  try {
    const events = await auditService.listAuditEvents(
      req.query.page, req.query.pageSize, req.query.action, req.query.integrationId,
      req.user, req.query.ownerId
    );
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
}

module.exports = { listAuditEvents };
