const express = require('express');
const router = express.Router();
const { getMe, updateProfile, getWalletHistory, changePassword } = require('../../controller/mobile/mobileUserController');
const { protect } = require('../../middleware/auth'); // Assuming protect middleware exists here

// All routes here are protected
router.use(protect);

router.get('/me', getMe);
router.post('/update', updateProfile);
router.get('/wallet', getWalletHistory);
router.post('/change-password', changePassword);


module.exports = router;
