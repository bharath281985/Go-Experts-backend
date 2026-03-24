const express = require('express');
const router = express.Router();
const { getConversations, getChatHistory, sendMessage } = require('../controller/messageController');
const { protect } = require('../middleware/auth');

router.get('/conversations', protect, getConversations);
router.get('/:userId', protect, getChatHistory);
router.post('/', protect, sendMessage);

module.exports = router;
