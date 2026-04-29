const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const { payWithWallet } = require('../../controller/paymentController');
const {
    getMobileSubscriptionPlans,
    getMobileSubscriptionPlanById,
    getMobileCurrentSubscriptionPlan,
    getMobileSubscriptionPlansForMe,
    completeMobileSubscriptionUpgrade
} = require('../../controller/mobile/mobileSubscriptionPlanController');

router.get('/', getMobileSubscriptionPlans);
router.get('/current', protect, getMobileCurrentSubscriptionPlan);
router.get('/for-me', protect, getMobileSubscriptionPlansForMe);
router.post('/upgrade', protect, completeMobileSubscriptionUpgrade);
router.post('/upgrade/wallet', protect, payWithWallet);
router.get('/:id', getMobileSubscriptionPlanById);

module.exports = router;
