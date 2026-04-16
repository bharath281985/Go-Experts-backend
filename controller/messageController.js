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
        .populate('sender', 'full_name username email profile_image')
        .populate('receiver', 'full_name username email profile_image');

        // Group by unique user id
        const conversationsMap = new Map();

        messages.forEach(msg => {
            // Safety check for deleted users
            if (!msg.sender || !msg.receiver) return;

            const isSender = msg.sender._id.toString() === userId.toString();
            const otherUser = isSender ? msg.receiver : msg.sender;
            
            if (!otherUser || !otherUser._id) return;
            const otherUserId = otherUser._id.toString();

            if (!conversationsMap.has(otherUserId)) {
                conversationsMap.set(otherUserId, {
                    user: otherUser,
                    lastMessage: msg,
                    unreadCount: (!isSender && !msg.isRead) ? 1 : 0
                });
            } else {
                if (!isSender && !msg.isRead) {
                    const conv = conversationsMap.get(otherUserId);
                    if (conv) conv.unreadCount++;
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
            const UserSubscription = require('../models/UserSubscription');

            // Find active subscription for the sender
            const subscription = await UserSubscription.findOne({
                user_id: senderId,
                status: 'active',
                end_date: { $gt: new Date() }
            });

            // 1. Check if sender has an active subscription with remaining chats
            if (!subscription) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'You need an active subscription to start new conversations.' 
                });
            }

            if (subscription.remaining_chats <= 0) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'You have reached your chat initiation limit for this period. Please upgrade your plan.' 
                });
            }

            // 2. Role-specific restrictions
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
                } else if (receiverUser.role !== 'admin') {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Freelancers can only message Clients with accepted invitations.' 
                    });
                }
            } else if (senderUser.role === 'investor') {
                if (receiverUser.role === 'startup_creator') {
                    const StartupIdea = require('../models/StartupIdea');
                    const SubscriptionUnlock = require('../models/SubscriptionUnlock');
                    
                    const creatorIdeas = await StartupIdea.find({ creator: receiverId }).distinct('_id');
                    const hasUnlocked = await SubscriptionUnlock.findOne({
                        user_id: senderId,
                        target_id: { $in: creatorIdeas },
                        target_type: 'startup_idea'
                    });

                    if (!hasUnlocked) {
                        return res.status(403).json({ 
                            success: false, 
                            message: 'Investors must unlock at least one idea from this Founder before messaging.' 
                        });
                    }
                }
            } else if (senderUser.role === 'startup_creator') {
                if (receiverUser.role === 'investor' || receiverUser.role === 'client') {
                     return res.status(403).json({ 
                        success: false, 
                        message: 'Founders cannot initiate messages with Investors first. Wait for them to contact you.' 
                    });
                }
            }

            // If all checks pass, deduct one chat slot
            subscription.remaining_chats -= 1;
            await subscription.save();
        }

        const msg = await Message.create({
            sender: req.user.id,
            receiver: receiverId,
            content
        });

        const populatedMsg = await msg.populate('sender', 'full_name username email profile_image');
        
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

        // Non-blocking email notification
        try {
            const sendEmail = require('../utils/sendEmail');
            const receiverUser = await User.findById(receiverId);
            const senderUser = await User.findById(req.user.id);
            
            await sendEmail({
                email: receiverUser.email,
                subject: `New Message from ${senderUser.full_name}`,
                templateTrigger: 'new_chat_message',
                templateData: {
                    sender_name: senderUser.full_name,
                    message_preview: content.substring(0, 100),
                    login_link: `${process.env.FRONTEND_URL}/signin`
                },
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>New Message Alert</h2>
                        <p>You have received a new message from <strong>${senderUser.full_name}</strong> on GoExperts.</p>
                        <blockquote style="border-left: 4px solid #F24C20; padding-left: 15px; margin: 20px 0; color: #555 italic;">
                            "${content.substring(0, 300)}${content.length > 300 ? '...' : ''}"
                        </blockquote>
                        <a href="${process.env.FRONTEND_URL}/signin" style="background: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; display: inline-block;">Reply Now</a>
                    </div>
                `
            });
        } catch (mailErr) {
            console.error('Chat notification email failed:', mailErr.message);
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
