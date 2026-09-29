function checkHealth(req, res) {
  res.json({
    success: true,
    service: "IntegraHub API",
    status: "online"
  });
}

module.exports = {
  checkHealth
};
