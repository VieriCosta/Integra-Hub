const authService = require("../services/authService");

async function setupStatus(req, res, next) {
  try {
    res.json({ success: true, data: { required: await authService.setupRequired() } });
  } catch (error) { next(error); }
}

async function setup(req, res, next) {
  try {
    const user = await authService.setupAdmin(req, res);
    res.status(201).json({ success: true, data: user });
  } catch (error) { next(error); }
}

async function login(req, res, next) {
  try {
    const user = await authService.login(req.body.email, req.body.password, req, res);
    res.json({ success: true, data: user });
  } catch (error) { next(error); }
}

async function me(req, res) {
  res.json({ success: true, data: req.user });
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.sessionId, res);
    res.json({ success: true });
  } catch (error) { next(error); }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, res);
    res.json({ success: true });
  } catch (error) { next(error); }
}

module.exports = { setupStatus, setup, login, me, logout, changePassword };
