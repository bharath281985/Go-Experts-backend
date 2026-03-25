const express = require('express');
const router = express.Router();
const { getStats, getPipeline, updateOpportunity, trackIdea } = require('../controller/investorDashboardController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('investor', 'admin'));

router.get('/dashboard/stats', getStats);
router.get('/dashboard/pipeline', getPipeline);
router.patch('/dashboard/pipeline/:id', updateOpportunity);
router.post('/dashboard/track/:ideaId', trackIdea);

module.exports = router;
