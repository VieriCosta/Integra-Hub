const router = require('express').Router();
const service = require('../services/automationService');
router.get('/', async (req, res, next) => { try { res.json({ success: true, data: await service.overview(req.user, req.query.ownerId) }); } catch (error) { next(error); } });
router.put('/integrations/:id', async (req, res, next) => { try { res.json({ success: true, data: await service.settings(req.params.id, req.body, req.user) }); } catch (error) { next(error); } });
router.post('/alerts/:id/acknowledge', async (req, res, next) => { try { await service.acknowledge(req.params.id, req.user); res.json({ success: true }); } catch (error) { next(error); } });
module.exports = router;
