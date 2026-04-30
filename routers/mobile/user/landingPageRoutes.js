const express = require('express');
const router = express.Router();
const landingPageController = require('../../../controller/mobile/user/landingPageController');
const upload = require('../../../middleware/upload');

router.get('/landing-page', landingPageController.getLandingPage);
router.put('/landing-page', upload.single('landing_image'), landingPageController.updateLandingPage);

module.exports = router;
