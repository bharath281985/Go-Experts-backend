const mongoose = require('mongoose');
require('dotenv').config({path: './.env'});

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Message = mongoose.model('Message', new mongoose.Schema({
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        isRead: Boolean
    }, { strict: false }));

    const req = { user: { id: '69e1cb013ce313c4967e4ae5' } };
    const messages = await Message.find({ $or: [{ sender: req.user.id }, { receiver: req.user.id }] }).sort({ createdAt: -1 });
    
    const conversationsMap = new Map();
    messages.forEach(msg => {
        const isSender = msg.sender && msg.sender.toString() === req.user.id.toString();
        const otherUser = isSender ? msg.receiver : msg.sender;
        if (!otherUser) return;
        const otherUserId = otherUser.toString();

        if (!conversationsMap.has(otherUserId)) {
            conversationsMap.set(otherUserId, {
                unreadCount: (!isSender && !msg.isRead) ? 1 : 0
            });
        } else {
            if (!isSender && !msg.isRead) {
                conversationsMap.get(otherUserId).unreadCount++;
            }
        }
    });

    const totalUnread = Array.from(conversationsMap.values()).reduce((sum, c) => sum + c.unreadCount, 0);
    console.log('Total Unread:', totalUnread, 'Conv map:', Array.from(conversationsMap.entries()));
    process.exit(0);
});
