const express = require('express');
const router = express.Router();
const { 
  createProject, 
  getProjects, 
  getProjectById, 
  expressInterest, 
  getMyProjects, 
  getProjectProposals, 
  awardProject, 
  acceptProjectAward, 
  completeProject, 
  submitReview,
  updateProject
} = require('../controller/projectController');
const { protect, authorize, optionalProtect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(getProjects)
    .post(protect, authorize('client'), upload.array('attachments', 5), createProject);

router.get('/my', protect, authorize('client', 'freelancer'), getMyProjects);

router.route('/:id')
    .get(optionalProtect, getProjectById)
    .put(protect, authorize('client'), upload.array('attachments', 5), updateProject);

router.post('/:id/interest', protect, authorize('freelancer'), expressInterest);
router.post('/:id/review', protect, submitReview);
router.get('/:id/proposals', protect, authorize('client'), getProjectProposals);
router.put('/:id/accept', protect, acceptProjectAward);
router.put('/:id/complete', protect, completeProject);
router.put('/:id/award/:proposalId', protect, authorize('client'), awardProject);

module.exports = router;
