import { Server, Socket } from 'socket.io';

export const handlePresence = (io: Server, socket: Socket) => {
  const userId = (socket as any).user?.id;
  
  if (userId) {
    // Notify anyone subscribed to this user's presence
    io.to(`presence:${userId}`).emit('presence:update', { userId, isOnline: true, lastSeen: null });
    io.to(`presence:${userId}`).emit('presence:online', { userId });

    socket.on('disconnect', async () => {
      const sockets = await io.in(userId).fetchSockets();
      if (sockets.length === 0) {
        // User has no active sockets left
        io.to(`presence:${userId}`).emit('presence:update', { userId, isOnline: false, lastSeen: new Date() });
        io.to(`presence:${userId}`).emit('presence:offline', { userId });
      }
    });
  }

  // Targeted presence subscriptions
  socket.on('presence:subscribe', ({ targetUserId }) => {
    if (targetUserId) {
      socket.join(`presence:${targetUserId}`);
      // Send immediate status upon subscription
      // We can check if targetUserId has any active sockets
      io.in(targetUserId).fetchSockets().then((sockets) => {
        const isOnline = sockets.length > 0;
        socket.emit('presence:update', { 
          userId: targetUserId, 
          isOnline, 
          lastSeen: isOnline ? null : new Date() // Fallback if no DB query
        });
      });
    }
  });

  socket.on('presence:unsubscribe', ({ targetUserId }) => {
    if (targetUserId) {
      socket.leave(`presence:${targetUserId}`);
    }
  });
};
