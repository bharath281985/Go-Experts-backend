import { Server, Socket } from 'socket.io';

export const handlePresence = (io: Server, socket: Socket) => {
  const userId = (socket as any).user?.id;
  if (!userId) return;

  io.emit('presence:update', { userId, isOnline: true, lastSeen: null });
  io.emit('presence:online', { userId });

  socket.on('disconnect', async () => {
    const sockets = await io.in(userId).fetchSockets();
    if (sockets.length === 0) {
      io.emit('presence:update', { userId, isOnline: false, lastSeen: new Date() });
      io.emit('presence:offline', { userId });
    }
  });
};
