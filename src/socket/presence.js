"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePresence = void 0;
const handlePresence = (io, socket) => {
    const userId = socket.user?.id;
    if (!userId)
        return;
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
exports.handlePresence = handlePresence;
