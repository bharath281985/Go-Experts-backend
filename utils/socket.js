const socketIo = require('socket.io');

let io;

// Map to store connected users: userId -> socketId
const connectedUsers = new Map();

module.exports = {
  init: (server) => {
    io = socketIo(server, {
      cors: {
        origin: '*', // Adjust to your frontend domain in production
        methods: ['GET', 'POST']
      }
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('register', (userId) => {
        if (userId) {
          connectedUsers.set(userId, socket.id);
          console.log(`User ${userId} registered with socket ${socket.id}`);
          io.emit('userOnline', userId);
        }
      });

      // ---- WebRTC Signaling ----
      socket.on('callUser', async ({ userToCall, signalData, from, name }) => {
        try {
          const Message = require('../models/Message');
          const count = await Message.countDocuments({
            $or: [
                { sender: from, receiver: userToCall },
                { sender: userToCall, receiver: from }
            ]
          });
          
          if (count === 0) {
              socket.emit('callError', 'You must exchange messages before initiating a video call.');
              return;
          }

          const socketId = connectedUsers.get(userToCall);
          if (socketId) {
             io.to(socketId).emit('callUser', { signal: signalData, from, name });
          }
        } catch(e) { console.error('Socket call error', e) }
      });

      socket.on('answerCall', (data) => {
        const socketId = connectedUsers.get(data.to);
        if (socketId) {
           io.to(socketId).emit('callAccepted', data.signal);
        }
      });

      socket.on('endCall', ({ to }) => {
        const socketId = connectedUsers.get(to);
        if (socketId) {
           io.to(socketId).emit('endCall');
        }
      });

      socket.on('iceCandidate', ({ to, candidate }) => {
        const socketId = connectedUsers.get(to);
        if (socketId) {
           io.to(socketId).emit('iceCandidate', candidate);
        }
      });
      // --------------------------

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        for (const [userId, socketId] of connectedUsers.entries()) {
          if (socketId === socket.id) {
            connectedUsers.delete(userId);
            io.emit('userOffline', userId);
            break;
          }
        }
      });
    });

    return io;
  },

  getIo: () => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    return io;
  },

  getReceiverSocketId: (receiverId) => {
    return connectedUsers.get(receiverId);
  }
};
