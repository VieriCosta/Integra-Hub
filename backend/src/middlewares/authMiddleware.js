const authService = require("../services/authService");
const { AppError } = require("../utils/AppError");

async function requireAuth(req, res, next) {
  try {
    const { user, sessionId } = await authService.authenticate(req);
    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") return next(new AppError("Acesso restrito ao administrador.", 403));
  next();
}

module.exports = { requireAuth, requireAdmin };
