const express = require('express');
const router = express.Router();
const resumeController = require('../../../controller/mobile/user/resumeController');

router.get('/resume', resumeController.getResumeDetails);
router.put('/resume', resumeController.updateResume);
router.put('/experience', resumeController.updateExperience);
router.put('/education', resumeController.updateEducation);
router.delete('/experience/:id', resumeController.deleteExperience);
router.delete('/education/:id', resumeController.deleteEducation);

module.exports = router;
