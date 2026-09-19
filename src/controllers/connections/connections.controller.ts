import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import type { AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { emitNotification } from '../../services/notifications/notification-events.service.js';

// GET /connections
export const getConnections = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { userOneId: userId },
          { userTwoId: userId }
        ],
        status: 'ACTIVE'
      },
      include: {
        userOne: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        userTwo: { select: { id: true, fullName: true, avatarUrl: true, role: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formatted = await Promise.all(connections.map(async c => {
      const isUserOne = c.userOneId === userId;
      const peer = isUserOne ? c.userTwo : c.userOne;

      // Find associated conversation
      const conv = await prisma.conversation.findFirst({
        where: {
          OR: [
            { userA: c.userOneId, userB: c.userTwoId },
            { userA: c.userTwoId, userB: c.userOneId }
          ]
        },
        select: { id: true }
      });

      return {
        id: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        peerId: peer.id,
        name: peer.fullName,
        role: peer.role,
        avatar: peer.avatarUrl,
        conversationId: conv?.id
      };
    }));

    return res.json({ success: true, rows: formatted });
  } catch (error) { next(error); }
};

// GET /connections/invitations
export const getReceivedInvitations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const invitations = await prisma.connectionInvitation.findMany({
      where: { receiverId: userId },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, rows: invitations });
  } catch (error) { next(error); }
};

// GET /connections/invitations/sent
export const getSentInvitations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const invitations = await prisma.connectionInvitation.findMany({
      where: { senderId: userId },
      include: {
        receiver: { select: { id: true, fullName: true, avatarUrl: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, rows: invitations });
  } catch (error) { next(error); }
};

// PATCH /connections/invitations/:id/accept
export const acceptInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    
    const invitation = await prisma.connectionInvitation.findUnique({
      where: { id },
      include: { sender: true, receiver: true }
    });

    if (!invitation || invitation.receiverId !== userId) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Invitation is no longer pending' });
    }

    // 1. Update status
    const updated = await prisma.connectionInvitation.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() }
    });

    // 2. Create Connection
    const [userOneId, userTwoId] = [invitation.senderId, invitation.receiverId].sort();
    
    await prisma.connection.upsert({
      where: {
        userOneId_userTwoId: { userOneId, userTwoId }
      },
      update: { status: 'ACTIVE' },
      create: {
        userOneId,
        userTwoId,
        status: 'ACTIVE'
      }
    });

    // 3. Create Conversation & Move Message
    const conversation = await prisma.conversation.create({
      data: {
        name: 'Chat',
        role: invitation.sender.role,
        status: 'active',
        userA: userOneId,
        userB: userTwoId,
        msg: invitation.firstMessage,
        time: new Date().toISOString()
      }
    });

    if (invitation.firstMessage) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          from: invitation.sender.fullName,
          senderId: invitation.senderId,
          text: invitation.firstMessage,
          time: new Date().toISOString()
        }
      });
    }

    // 4. Notify sender
    const title = 'Connection Accepted';
    const body = `${invitation.receiver.fullName} accepted your connection request.`;
    
    // Attempt emit web notification if possible
    try {
      await emitNotification({
        userId: invitation.senderId,
        type: 'CONNECTION_ACCEPTED',
        title,
        message: body,
        contextType: 'CONNECTION',
        contextId: id
      });
    } catch(err) {}

    const { getIo } = await import('../../socket/index.js');
    try {
      getIo().to(invitation.senderId).emit('connection_request_accepted', {
        connectionId: userOneId, // just payload
        invitationId: id
      });
    } catch (err) {}
    
    return res.json({ success: true, message: 'Invitation accepted successfully', data: updated });
  } catch (error) { next(error); }
};

// PATCH /connections/invitations/:id/reject
export const rejectInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    
    const invitation = await prisma.connectionInvitation.findUnique({ where: { id } });

    if (!invitation || invitation.receiverId !== userId) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Invitation is no longer pending' });
    }

    const updated = await prisma.connectionInvitation.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date() }
    });

    const { getIO } = await import('../../modules/realtime/socket.js');
    try {
      getIO().to(`user:${invitation.senderId}`).emit('connection_request_rejected', {
        invitationId: id
      });
    } catch (err) {}

    return res.json({ success: true, message: 'Invitation rejected', data: updated });
  } catch (error) { next(error); }
};

