const { AppError } = require("../utils/AppError");

function errorMiddleware(error, req, res, next) {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'JSON inválido na requisição.' });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Requisição excede o limite de 1 MB." });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  // Database and parser errors may carry queries, request bodies or credentials.
  console.error('Erro interno:', { name: error.name, code: error.code });

  return res.status(500).json({
    success: false,
    message: "Erro interno do servidor."
  });
}

module.exports = errorMiddleware;
