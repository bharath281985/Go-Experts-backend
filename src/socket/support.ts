import { Server, Socket } from 'socket.io';
import { prisma } from '../config/database.js';

export const handleSupportEvents = (io: Server, socket: Socket) => {
  const user = (socket as any).user;
  const userId = user?.id;
  const userRole = user?.role;
  if (!userId) return;

  // Join a specific ticket room
  socket.on('support:join', async ({ ticketId }) => {
    if (!ticketId) return;
    try {
      const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket) return;

      // Ensure user has access
      if (ticket.requesterId !== userId && userRole !== 'admin' && userRole !== 'support') {
        socket.emit('error', { message: 'UNAUTHORIZED_TICKET_JOIN' });
        return;
      }
      
      socket.join(`support-ticket:${ticketId}`);
    } catch (err) {
      console.error("Error joining support ticket:", err);
    }
  });

  // Leave a ticket room
  socket.on('support:leave', ({ ticketId }) => {
    if (ticketId) socket.leave(`support-ticket:${ticketId}`);
  });

  // Typing indicators
  socket.on('support:typing:start', ({ ticketId }) => {
    if (ticketId) socket.to(`support-ticket:${ticketId}`).emit('support:typing:start', { ticketId, userId, role: userRole });
  });

  socket.on('support:typing:stop', ({ ticketId }) => {
    if (ticketId) socket.to(`support-ticket:${ticketId}`).emit('support:typing:stop', { ticketId, userId, role: userRole });
  });
};
