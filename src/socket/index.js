"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIo = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const auth_js_1 = require("./auth.js");
const presence_js_1 = require("./presence.js");
const chat_js_1 = require("./chat.js");
let io;
const socketOrigins = [
    'https://goexperts.in',
    'https://www.goexperts.in',
    'https://adminai.goexperts.in',
    'https://apiai.goexperts.in',
    'https://mobileapi.goexperts.in',
];
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin)
                    return callback(null, true);
                if (socketOrigins.includes(origin) ||
                    origin.startsWith('http://localhost:') ||
                    origin.startsWith('http://127.0.0.1:')) {
                    return callback(null, true);
                }
                return callback(new Error('Not allowed by CORS'));
            },
            credentials: true,
        },
    });
    io.use(auth_js_1.socketAuth);
    io.on('connection', (socket) => {
        const userId = socket.user?.id;
        if (userId) {
            socket.join(userId);
        }
        (0, presence_js_1.handlePresence)(io, socket);
        (0, chat_js_1.handleChatEvents)(io, socket);
    });
};
exports.initSocket = initSocket;
const getIo = () => {
    if (!io) {
        throw new Error('Socket.IO is not initialized');
    }
    return io;
};
exports.getIo = getIo;
