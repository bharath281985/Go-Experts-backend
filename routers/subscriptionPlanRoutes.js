const express = require('express');
const router = express.Router();
const { 
    getSubscriptionPlans, 
    getAllPlansAdmin,
    createSubscriptionPlan, 
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    getSubscriptionPlanById
} = require('../controller/subscriptionPlanController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getSubscriptionPlans);

// Admin only routes
router.use(protect, authorize('admin'));

router.get('/admin', getAllPlansAdmin);
router.get('/:id', getSubscriptionPlanById);
router.post('/', createSubscriptionPlan);

router.route('/:id')
    .put(updateSubscriptionPlan)
    .delete(deleteSubscriptionPlan);

module.exports = router;
