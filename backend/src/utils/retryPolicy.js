function canRetry(method, result, attempt, maxRetries) {
  return method === 'GET' && result.status === 'ERROR' && attempt <= maxRetries && [429, 502, 503, 504].includes(result.httpStatus);
}
module.exports = { canRetry };
