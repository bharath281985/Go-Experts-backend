const express = require('express');
const router = express.Router();
const { createProject, getProjects, getProjectById, expressInterest, getMyProjects } = require('../controller/projectController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(getProjects)
    .post(protect, authorize('client'), upload.array('attachments', 5), createProject);

router.get('/my', protect, authorize('client'), getMyProjects);

router.route('/:id')
    .get(getProjectById);

router.post('/:id/interest', protect, authorize('freelancer'), expressInterest);

module.exports = router;
