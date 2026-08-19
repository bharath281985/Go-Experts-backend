import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database.js';

export const handleChatEvents = (io: Server, socket: Socket) => {
  const userId = (socket as any).user?.id;
  if (!userId) return;

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

  socket.on('message:send', async ({ conversationId, text, attachmentUrl }, callback) => {
    if (!conversationId || !text) return;
    try {
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conv) return;

      const recipientId = conv.userA === userId ? conv.userB : conv.userA;
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          from: userId,
          text,
          attachmentUrl: attachmentUrl || null,
          time: new Date().toISOString(),
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { 
          msg: text, 
          updatedAt: new Date(),
          unread: { increment: 1 }
        },
      });

      const payload = {
        id: message.id,
        conversationId,
        from: 'them',
        senderId: userId,
        text,
        attachmentUrl,
        time: message.time,
        createdAt: message.createdAt,
        read: false,
      };

      // Broadcast to room (other participants)
      socket.to(`conversation:${conversationId}`).emit('message:new', payload);
      
      // Also broadcast directly to recipient just in case they are not in the room yet
      if (recipientId) {
        io.to(recipientId).emit('message:new', payload);
      }

      if (typeof callback === 'function') {
        callback({ success: true, message: { ...payload, from: 'me' } });
      }
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('message:read', async ({ messageId, conversationId, senderId }) => {
    try {
      if (messageId) {
        await prisma.message.update({
          where: { id: messageId },
          data: { readAt: new Date() },
        });
      }
      if (conversationId) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { unread: 0 },
        });
      }
      
      if (senderId) {
        io.to(senderId).emit('message:read', { messageId, conversationId, readBy: userId });
      }
    } catch (e) {
      // ignore
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
