const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get chat conversations (unique users)
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Find all messages where user is sender or receiver
        const messages = await Message.find({
            $or: [{ sender: userId }, { receiver: userId }]
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'full_name profile_image')
        .populate('receiver', 'full_name profile_image');

        // Group by unique user id
        const conversationsMap = new Map();

        messages.forEach(msg => {
            const isSender = msg.sender._id.toString() === userId.toString();
            const otherUser = isSender ? msg.receiver : msg.sender;
            const otherUserId = otherUser._id.toString();

            if (!conversationsMap.has(otherUserId)) {
                conversationsMap.set(otherUserId, {
                    user: otherUser,
                    lastMessage: msg,
                    unreadCount: (!isSender && !msg.isRead) ? 1 : 0
                });
            } else {
                if (!isSender && !msg.isRead) {
                    conversationsMap.get(otherUserId).unreadCount++;
                }
            }
        });

        const conversations = Array.from(conversationsMap.values());
        res.json({ success: true, data: conversations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get chat history with a specific user
// @route   GET /api/messages/:userId
// @access  Private
exports.getChatHistory = async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = req.params.userId;

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ]
        }).sort({ createdAt: 1 });

        // Mark incoming messages as read
        await Message.updateMany(
            { sender: otherId, receiver: myId, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({ success: true, data: messages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body;

        if (!receiverId || !content) {
            return res.status(400).json({ success: false, message: 'Receiver and content are required' });
        }

        const senderId = req.user.id;

        // Messaging restrictions logic
        const previousMessage = await Message.findOne({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        });

        if (!previousMessage) {
            const senderUser = await User.findById(senderId);
            const receiverUser = await User.findById(receiverId);

            if (senderUser.role === 'freelancer') {
                if (receiverUser.role === 'client') {
                    const Invitation = require('../models/Invitation');
                    const validInvite = await Invitation.findOne({
                        client_id: receiverId,
                        freelancer_id: senderId,
                        status: 'accepted'
                    });

                    if (!validInvite) {
                        return res.status(403).json({ 
                            success: false, 
                            message: 'Freelancers cannot initiate a conversation with a Client without an accepted invitation.' 
                        });
                    }
                } else {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Freelancers can only message Clients with accepted invitations.' 
                    });
                }
            }
        }

        const msg = await Message.create({
            sender: req.user.id,
            receiver: receiverId,
            content
        });

        const populatedMsg = await msg.populate('sender', 'full_name profile_image');
        
        try {
            const socketHandler = require('../utils/socket');
            const receiverSocketId = socketHandler.getReceiverSocketId(receiverId.toString());
            if (receiverSocketId) {
                socketHandler.getIo().to(receiverSocketId).emit('newMessage', populatedMsg);
            }
        } catch (e) {
            console.log('Socket mapping error', e);
        }
        
        res.status(201).json({ success: true, data: populatedMsg });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
