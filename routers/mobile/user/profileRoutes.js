const express = require('express');
const router = express.Router();
const profileController = require('../../../controller/mobile/user/profileController');

router.get('/me', profileController.getMe);
router.put('/update', profileController.updateProfile);
router.post('/change-password', profileController.changePassword);

module.exports = router;
