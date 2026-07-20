import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
let io = null;
function extractToken(socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
        return authToken.startsWith("Bearer ") ? authToken.slice(7) : authToken;
    }
    const header = socket.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
        return header.slice(7);
    }
    return null;
}
export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || env.FRONTEND_URL || "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    io.use(async (socket, next) => {
        try {
            const token = extractToken(socket);
            if (!token)
                return next(new Error("Authentication required"));
            const decoded = jwt.verify(token, env.JWT_SECRET);
            socket.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                type: decoded.type,
            };
            next();
        }
        catch {
            next(new Error("Invalid token"));
        }
    });
    io.on("connection", (socket) => {
        const user = socket.user;
        if (!user?.id) {
            socket.disconnect(true);
            return;
        }
        const userRoom = `user:${user.id}`;
        socket.join(userRoom);
        socket.emit("presence:online", { userId: user.id, online: true });
        socket.to(userRoom).emit("presence:online", { userId: user.id, online: true });
        socket.on("presence:online", () => {
            socket.emit("presence:online", { userId: user.id, online: true });
            if (io)
                io.to(userRoom).emit("presence:online", { userId: user.id, online: true });
        });
        socket.on("message:send", async (payload, ack) => {
            try {
                const conversationId = payload?.conversationId;
                const text = payload?.text;
                if (!conversationId || !text) {
                    ack?.({ success: false, message: "conversationId and text required" });
                    return;
                }
                const room = `conversation:${conversationId}`;
                socket.join(room);
                let message = null;
                try {
                    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
                    if (conversation) {
                        const nowLabel = new Date().toLocaleTimeString();
                        message = await prisma.message.create({
                            data: {
                                conversationId,
                                from: payload.from || "me",
                                text,
                                time: nowLabel,
                            },
                        });
                        await prisma.conversation.update({
                            where: { id: conversationId },
                            data: { msg: text, time: nowLabel },
                        });
                    }
                }
                catch (persistErr) {
                    console.warn("Socket message persist skipped:", persistErr.message);
                }
                const outbound = {
                    conversationId,
                    text,
                    from: payload.from || user.id,
                    userId: user.id,
                    message,
                    createdAt: new Date().toISOString(),
                };
                if (io)
                    io.to(room).emit("message:new", outbound);
                ack?.({ success: true, data: outbound });
            }
            catch (e) {
                ack?.({ success: false, message: e.message });
            }
        });
        socket.on("typing:start", (payload) => {
            if (!payload?.conversationId)
                return;
            const room = `conversation:${payload.conversationId}`;
            socket.join(room);
            socket.to(room).emit("typing:start", { conversationId: payload.conversationId, userId: user.id });
        });
        socket.on("typing:stop", (payload) => {
            if (!payload?.conversationId)
                return;
            const room = `conversation:${payload.conversationId}`;
            socket.to(room).emit("typing:stop", { conversationId: payload.conversationId, userId: user.id });
        });
        socket.on("disconnect", () => {
            if (io)
                io.to(userRoom).emit("presence:online", { userId: user.id, online: false });
        });
    });
    console.log("Socket.IO initialized");
    return io;
}
export function getIO() {
    if (!io)
        throw new Error("Socket.IO not initialized. Call initSocket(httpServer) first.");
    return io;
}
