const express = require('express');
const router = express.Router();
const stepController = require('../controller/registrationStepController');
const { protect, authorize } = require('../middleware/auth');

// Public route for website
router.get('/', stepController.getSteps);

// Admin routes
router.get('/admin', protect, authorize('admin'), stepController.getAllStepsAdmin);
router.post('/', protect, authorize('admin'), stepController.createStep);
router.put('/reorder', protect, authorize('admin'), stepController.reorderSteps);
router.put('/:id', protect, authorize('admin'), stepController.updateStep);
router.delete('/:id', protect, authorize('admin'), stepController.deleteStep);


module.exports = router;
