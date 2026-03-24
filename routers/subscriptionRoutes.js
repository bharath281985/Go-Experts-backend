const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    unlockContent,
    getMySubscription,
    checkUnlockStatus
} = require('../controller/subscriptionController');

router.use(protect); // Ensure all routes are protected

router.get('/my-status', getMySubscription);
router.get('/is-unlocked/:targetId', checkUnlockStatus);
router.post('/unlock', unlockContent);

module.exports = router;
