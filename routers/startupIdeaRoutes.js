const express = require('express');
const router = express.Router();
const {
    submitIdea,
    getApprovedIdeas,
    getIdeaById,
    unlockContact,
    getMyIdeas,
    getCreatorStats,
    updateIdea
} = require('../controller/startupIdeaController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(getApprovedIdeas)
    .post(
        protect,
        upload.fields([
            { name: 'signednda', maxCount: 1 },
            { name: 'pitchDeck', maxCount: 1 },
            { name: 'ideaImages', maxCount: 6 },
            { name: 'attachments', maxCount: 6 }
        ]),
        submitIdea
    );

router.get('/my-ideas', protect, getMyIdeas);
router.get('/my-stats', protect, getCreatorStats);

router.route('/:id')
    .get(protect, getIdeaById)
    .put(protect, updateIdea);

router.route('/:id/unlock')
    .post(protect, unlockContact);

module.exports = router;
