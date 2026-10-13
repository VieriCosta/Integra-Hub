const router = require('express').Router();
const service = require('../services/environmentService');
router.get('/', async (req, res, next) => { try { res.json({ success: true, data: await service.list(req.user, req.query.ownerId) }); } catch (error) { next(error); } });
router.post('/', async (req, res, next) => { try { res.status(201).json({ success: true, data: await service.save(null, req.body, req.user) }); } catch (error) { next(error); } });
router.put('/:id', async (req, res, next) => { try { res.json({ success: true, data: await service.save(req.params.id, req.body, req.user) }); } catch (error) { next(error); } });
module.exports = router;
