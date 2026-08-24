import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database.js';
import { emitNotification } from '../services/notifications/notification-events.service.js';
import { checkRateLimit } from '../common/helpers/rate-limit.js';

export const handleChatEvents = (io: Server, socket: Socket) => {
  const user = (socket as any).user;
  const userId = user?.id;
  const userRole = user?.role;
  if (!userId) return;

  socket.on('conversation:join', async ({ conversationId }) => {
    if (!conversationId) return;
    try {
      if (!checkRateLimit(userId, 'join', 20, 10000)) return;
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conv) return;
      if (conv.userA !== userId && conv.userB !== userId && userRole !== 'admin') {
        socket.emit('error', { message: 'UNAUTHORIZED_CONVERSATION_JOIN' });
        return;
      }
      socket.join(`conversation:${conversationId}`);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('conversation:leave', ({ conversationId }) => {
    if (conversationId) socket.leave(`conversation:${conversationId}`);
  });

  socket.on('typing:start', ({ conversationId }) => {
    if (conversationId) socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId });
  });

  socket.on('typing:stop', ({ conversationId }) => {
    if (conversationId) socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
  });

  socket.on('message:send', async ({ conversationId, text, attachmentUrl, clientMessageId, replyToId }, callback) => {
    if (!conversationId || !text) return;
    try {
      if (!checkRateLimit(userId, 'msg:send', 10, 5000)) {
         return typeof callback === 'function' && callback({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
      }

      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conv) return typeof callback === 'function' && callback({ success: false, error: 'CONVERSATION_NOT_FOUND' });
      if (conv.userA !== userId && conv.userB !== userId && userRole !== 'admin') return typeof callback === 'function' && callback({ success: false, error: 'UNAUTHORIZED' });
      if (conv.status === 'BLOCKED' || conv.status === 'CLOSED') return typeof callback === 'function' && callback({ success: false, error: 'CONVERSATION_CLOSED' });

      const recipientId = conv.userA === userId ? conv.userB : conv.userA;
      
      // Idempotency check
      if (clientMessageId) {
        const existing = await prisma.message.findFirst({ where: { clientMessageId, conversationId, senderId: userId } });
        if (existing) return typeof callback === 'function' && callback({ success: true, message: existing });
      }

      // Attachment basic validation
      if (attachmentUrl) {
         const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
         const isValid = validExtensions.some(ext => attachmentUrl.toLowerCase().endsWith(ext));
         if (!isValid) return typeof callback === 'function' && callback({ success: false, error: 'INVALID_ATTACHMENT' });
      }

      // ReplyTo Validation
      if (replyToId) {
        const replyMsg = await prisma.message.findUnique({ where: { id: replyToId } });
        if (!replyMsg || replyMsg.conversationId !== conversationId) {
          return typeof callback === 'function' && callback({ success: false, error: 'INVALID_REPLY_REFERENCE' });
        }
      }

      const message = await prisma.message.create({
        data: {
          clientMessageId,
          conversationId,
          senderId: userId,
          from: userId,
          text,
          attachmentUrl: attachmentUrl || null,
          replyToId: replyToId || null,
          time: new Date().toISOString(),
        },
        include: { replyTo: true }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { msg: text, updatedAt: new Date(), unread: { increment: 1 } },
      });

      // Handle unarchiving for recipient
      if (recipientId) {
        const recipientState = await prisma.conversationState.findUnique({ where: { userId_conversationId: { userId: recipientId, conversationId } } });
        if (recipientState?.isArchived) {
          await prisma.conversationState.update({
             where: { id: recipientState.id },
             data: { isArchived: false }
          });
        }
      }

      const payload = {
        id: message.id,
        clientMessageId: message.clientMessageId,
        conversationId,
        from: 'them',
        senderId: userId,
        text,
        attachmentUrl,
        replyToId,
        replyTo: message.replyTo,
        time: message.time,
        createdAt: message.createdAt,
        read: false,
        deliveryStatus: message.deliveryStatus,
      };

      socket.to(`conversation:${conversationId}`).emit('message:new', payload);
      
      if (recipientId) {
        io.to(recipientId).emit('message:new', payload);
        
        // Notification Logic
        const recipientState = await prisma.conversationState.findUnique({ where: { userId_conversationId: { userId: recipientId, conversationId } } });
        if (!recipientState?.isMuted) {
          let actualContextId = conv.projectId || conv.investmentId || conv.startupIdeaId || conv.supportTicketId;
          await emitNotification({
             userId: recipientId,
             type: "MESSAGE_RECEIVED",
             title: "New Message",
             message: text.length > 50 ? text.substring(0, 50) + "..." : text,
             contextType: conv.contextType || undefined,
             contextId: actualContextId || undefined,
             actorId: userId,
             actionUrl: "/business/messages?conv=" + conv.id
          });
        }
      }

      if (typeof callback === 'function') callback({ success: true, message: { ...payload, from: 'me' } });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: 'SERVER_ERROR' });
    }
  });

  socket.on('message:delete', async ({ messageId, conversationId }, callback) => {
    try {
      if (!checkRateLimit(userId, 'msg:delete', 5, 5000)) return typeof callback === 'function' && callback({ success: false, error: 'RATE_LIMIT_EXCEEDED' });

      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg || msg.senderId !== userId) return typeof callback === 'function' && callback({ success: false, error: 'UNAUTHORIZED' });

      await prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() }
      });

      // Clear notifications referencing this if they are recent/unread (best-effort using matching text since we grouped)
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (conv) {
         const recipientId = conv.userA === userId ? conv.userB : conv.userA;
         if (recipientId) {
            const shortText = msg.text.length > 50 ? msg.text.substring(0, 50) + "..." : msg.text;
            await prisma.notification.deleteMany({
               where: {
                  userId: recipientId,
                  type: "MESSAGE_RECEIVED",
                  actorId: userId,
                  message: shortText,
                  readAt: null
               }
            });
         }
      }

      const payload = { messageId, conversationId, deletedAt: new Date() };
      socket.to(`conversation:${conversationId}`).emit('message:deleted', payload);
      
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false });
    }
  });

  socket.on('message:react', async ({ messageId, conversationId, reaction }, callback) => {
    try {
      if (!checkRateLimit(userId, 'msg:react', 15, 5000)) return typeof callback === 'function' && callback({ success: false, error: 'RATE_LIMIT_EXCEEDED' });

      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return typeof callback === 'function' && callback({ success: false, error: 'NOT_FOUND' });

      await prisma.messageReaction.upsert({
        where: { messageId_userId_reaction: { messageId, userId, reaction } },
        update: {},
        create: { messageId, userId, reaction }
      });

      const payload = { messageId, conversationId, userId, reaction };
      socket.to(`conversation:${conversationId}`).emit('message:reaction_added', payload);
      
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false });
    }
  });

  socket.on('message:read', async ({ messageId, conversationId, senderId }) => {
    try {
      if (messageId) await prisma.message.update({ where: { id: messageId }, data: { readAt: new Date() } });
      if (conversationId) await prisma.conversation.update({ where: { id: conversationId }, data: { unread: 0 } });
      
      socket.to(`conversation:${conversationId}`).emit('message:read', { messageId, conversationId, readBy: userId });
      if (senderId) io.to(senderId).emit('message:read', { messageId, conversationId, readBy: userId });
    } catch (e) {}
  });

  socket.on('notification:read', async ({ notificationId }) => {
    try {
      if (!notificationId) return;
      await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { readAt: new Date(), status: 'read' } });
      io.to(userId).emit('notification:updated', { notificationId, read: true });
    } catch (e) {}
  });

  socket.on('notification:read-all', async () => {
    try {
      await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date(), status: 'read' } });
      io.to(userId).emit('notification:count', { unread: 0 });
    } catch (e) {}
  });
};
