const express = require('express');
const router = express.Router();
const { getMyInvitations, updateInvitation, sendInvitation } = require('../controller/invitationController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getMyInvitations);
router.post('/', protect, sendInvitation);
router.put('/:id', protect, updateInvitation);

module.exports = router;
