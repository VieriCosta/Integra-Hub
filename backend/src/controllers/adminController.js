const adminService = require("../services/adminService");

async function listUsers(req, res, next) {
  try {
    res.json({ success: true, data: await adminService.listUsers(req.query.page, req.query.pageSize) });
  } catch (error) { next(error); }
}

async function createUser(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await adminService.createUser(req.body) });
  } catch (error) { next(error); }
}

async function updateUser(req, res, next) {
  try {
    res.json({ success: true, data: await adminService.updateUser(req.params.id, req.body, req.user.id) });
  } catch (error) { next(error); }
}

async function resetPassword(req, res, next) {
  try {
    await adminService.resetPassword(req.params.id, req.body.password);
    res.json({ success: true });
  } catch (error) { next(error); }
}

module.exports = { listUsers, createUser, updateUser, resetPassword };
