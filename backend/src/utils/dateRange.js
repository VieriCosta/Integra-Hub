const { AppError } = require('./AppError');

function dateRange(from, to) {
  const range = {};
  for (const [value, key] of [[from, 'gte'], [to, 'lte']]) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new AppError('Data inválida.', 400);
    range[key] = date;
  }
  if (range.gte && range.lte && range.gte > range.lte) throw new AppError('O início deve preceder o fim.', 400);
  return Object.keys(range).length ? { createdAt: range } : {};
}
module.exports = { dateRange };
