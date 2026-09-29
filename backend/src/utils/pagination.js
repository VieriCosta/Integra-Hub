const { AppError } = require("./AppError");

function parsePagination(pageValue = 1, pageSizeValue = 20) {
  const page = Number(pageValue);
  const pageSize = Number(pageSizeValue);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AppError("Paginação inválida. Use page >= 1 e pageSize entre 1 e 100.", 400);
  }
  return { page, pageSize };
}

module.exports = { parsePagination };
