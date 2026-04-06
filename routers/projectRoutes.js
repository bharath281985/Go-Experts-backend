const express = require('express');
const router = express.Router();
const { createProject, getProjects, getProjectById, expressInterest, getMyProjects, getProjectProposals, awardProject, acceptProjectAward, completeProject } = require('../controller/projectController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(getProjects)
    .post(protect, authorize('client'), upload.array('attachments', 5), createProject);

router.get('/my', protect, authorize('client'), getMyProjects);

router.route('/:id')
    .get(getProjectById);

router.post('/:id/interest', protect, authorize('freelancer'), expressInterest);
router.get('/:id/proposals', protect, authorize('client'), getProjectProposals);
router.put('/:id/accept', protect, acceptProjectAward);
router.put('/:id/complete', protect, completeProject);
router.put('/:id/award/:proposalId', protect, authorize('client'), awardProject);

module.exports = router;
