const express = require('express');
const router = express.Router();
const { scheduleMeeting, getMeetings, updateMeeting } = require('../controller/meetingController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', scheduleMeeting);
router.get('/', getMeetings);
router.patch('/:id', updateMeeting);

module.exports = router;
