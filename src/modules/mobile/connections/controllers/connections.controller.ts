import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';
// We will emit Socket.IO events in future iteration.

// GET /connections
export const getConnections = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    
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

    return res.json(successResponse('Connections fetched successfully', formatted));
  } catch (error) { next(error); }
};

// GET /connections/invitations
export const getReceivedInvitations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.connectionInvitation.findMany({
      where: { receiverId: req.user.id },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const censoredInvitations = invitations.map(inv => ({
      ...inv,
      firstMessage: inv.status === 'PENDING' ? null : inv.firstMessage
    }));

    return res.json(successResponse('Received invitations retrieved', censoredInvitations));
  } catch (error) { next(error); }
};

// GET /connections/invitations/sent
export const getSentInvitations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.connectionInvitation.findMany({
      where: { senderId: req.user.id },
      include: {
        receiver: { select: { id: true, fullName: true, avatarUrl: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(successResponse('Sent invitations retrieved', invitations));
  } catch (error) { next(error); }
};

// PATCH /connections/invitations/:id/accept
export const acceptInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const invitation = await prisma.connectionInvitation.findUnique({
      where: { id },
      include: { sender: true, receiver: true }
    });

    if (!invitation || invitation.receiverId !== req.user.id) {
      return res.status(404).json(errorResponse('Invitation not found', 'NOT_FOUND'));
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json(errorResponse('Invitation is no longer pending', 'INVALID_STATUS'));
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
    await NotificationEngine.queueNotification({
      userId: invitation.senderId,
      type: 'connection_accepted',
      title,
      message: body,
      channel: 'all',
      payload: { connectionId: id }
    });

    const { getIO } = await import('../../../../modules/realtime/socket.js');
    try {
      getIO().to(`user:${invitation.senderId}`).emit('connection_request_accepted', {
        connectionId: userOneId, // Just giving them the data
        invitationId: id
      });
    } catch (err) {}
    
    return res.json(successResponse('Invitation accepted successfully', updated));
  } catch (error) { next(error); }
};

// PATCH /connections/invitations/:id/reject
export const rejectInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const invitation = await prisma.connectionInvitation.findUnique({ where: { id } });

    if (!invitation || (invitation.receiverId !== req.user.id && invitation.senderId !== req.user.id)) {
      return res.status(404).json(errorResponse('Invitation not found', 'NOT_FOUND'));
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json(errorResponse('Invitation is no longer pending', 'INVALID_STATUS'));
    }

    // Sender is withdrawing their own invitation -> Delete it
    if (invitation.senderId === req.user.id) {
       await prisma.connectionInvitation.delete({ where: { id } });
       return res.json(successResponse('Invitation withdrawn successfully', { id }));
    }

    // Receiver is rejecting it -> Update status and block
    const updated = await prisma.connectionInvitation.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date() }
    });

    // Clear any orphaned Direct Message conversations between the two users
    await prisma.conversation.deleteMany({
      where: {
        OR: [
          { userA: invitation.senderId, userB: invitation.receiverId },
          { userA: invitation.receiverId, userB: invitation.senderId }
        ],
        projectId: null
      }
    });

    // Upsert Connection state to BLOCKED
    const [userOneId, userTwoId] = [invitation.senderId, invitation.receiverId].sort();
    await prisma.connection.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      update: { status: 'BLOCKED' },
      create: { userOneId, userTwoId, status: 'BLOCKED' }
    });

    return res.json(successResponse('Invitation rejected successfully', updated));
  } catch (error) { next(error); }
};

