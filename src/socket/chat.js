"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChatEvents = void 0;
const handleChatEvents = (io, socket) => {
    const userId = socket.user?.id;
    if (!userId)
        return;
    socket.on('conversation:join', ({ conversationId }) => {
        if (conversationId) {
            socket.join(`conversation:${conversationId}`);
        }
    });
    socket.on('conversation:leave', ({ conversationId }) => {
        if (conversationId) {
            socket.leave(`conversation:${conversationId}`);
        }
    });
    socket.on('typing:start', ({ conversationId, recipientId }) => {
        if (recipientId) {
            io.to(recipientId).emit('typing:start', { conversationId, userId });
        }
        if (conversationId) {
            socket.to(`conversation:${conversationId}`).emit('typing:start', {
                conversationId,
                userId,
            });
        }
    });
    socket.on('typing:stop', ({ conversationId, recipientId }) => {
        if (recipientId) {
            io.to(recipientId).emit('typing:stop', { conversationId, userId });
        }
        if (conversationId) {
            socket.to(`conversation:${conversationId}`).emit('typing:stop', {
                conversationId,
                userId,
            });
        }
    });
    socket.on('message:read', ({ messageId, conversationId, senderId }) => {
        if (senderId) {
            io.to(senderId).emit('message:read', { messageId, conversationId, readBy: userId });
        }
    });
    socket.on('message:delivered', ({ messageId, conversationId, senderId }) => {
        if (senderId) {
            io.to(senderId).emit('message:delivered', {
                messageId,
                conversationId,
                deliveredTo: userId,
            });
        }
    });
};
exports.handleChatEvents = handleChatEvents;
